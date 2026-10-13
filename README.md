# GERage

An app for Ger to manage his cars and the kilometers driven.

## Structure

```
apps/web   React SPA (Vite)
infra      AWS CDK stack: hosting, login and data storage
```

## How it works

- **Hosting:** the SPA is served at https://gerage.niklaskors.com from a private S3 bucket through
  CloudFront. The certificate lives in a separate `GerageCertificate` stack in `us-east-1`, because
  CloudFront requires that; the DNS records go into the existing `niklaskors.com` Route 53 zone.
- **Login:** Cognito user pool with the hosted login page. Sign-up is disabled, so users must be invited.
- **Data:** each user has one JSON file at `s3://<data bucket>/users/<identity id>/data.json`.
  A Cognito identity pool gives the logged-in browser temporary AWS credentials that only allow
  access to that user's own folder. There is no backend.
- **Conflicts:** saves use S3 conditional writes (`If-Match` on the ETag). If another device saved in
  between, the app reloads and applies the change again.
- **Backups:** the data bucket is versioned and keeps the last 50 versions of each file (the current one
  plus 49 earlier saves). Older versions are removed a day after they drop out of that window.

## Setup

```sh
pnpm install
```

## Deploy

Every push to `main` deploys automatically via GitHub Actions (`.github/workflows/deploy.yml`).
GitHub logs in to AWS with OIDC (no stored keys) through the `gerage-github-deploy` role, which only
trusts the `main` branch of this repo.

The stacks are pinned to account `833741619535`, so deploying with credentials for any other account
fails. Locally, deploys use the `personal` AWS profile (`~/.aws/credentials`).

### Infra setup flow

The infra consists of four CDK stacks in AWS account `833741619535`:

| Stack                | Region         | Deployed by    | Contains                                           |
| -------------------- | -------------- | -------------- | -------------------------------------------------- |
| `GerageGithubDeploy` | `eu-central-1` | hand, once     | IAM role GitHub Actions deploys with               |
| `GerageCertificate`  | `us-east-1`    | GitHub Actions | HTTPS certificate (CloudFront requires us-east-1)  |
| `GerageEmail`        | `eu-central-1` | GitHub Actions | SES domain + DNS (DKIM, SPF, DMARC) for login mail |
| `Gerage`             | `eu-central-1` | GitHub Actions | Hosting, DNS, Cognito, data bucket                 |

To set it up from scratch (already done for this account):

1. **AWS profile:** add an access key of an IAM user (not root) to `~/.aws/credentials` as `[personal]`,
   and check it with `aws sts get-caller-identity --profile personal`.
2. **CDK bootstrap**, once per region. This account is already bootstrapped in `eu-central-1` and
   `us-east-1`, and the bootstrap is shared with other projects, so don't run it again here:
   ```sh
   pnpm --filter @gerage/infra exec cdk bootstrap --profile personal aws://<account>/eu-central-1 aws://<account>/us-east-1
   ```
3. **GitHub role**, by hand, so the workflow can't change its own permissions:
   ```sh
   pnpm --filter @gerage/infra run deploy:github-role
   ```
   It reuses the account's existing GitHub OIDC provider (there can only be one per account).
4. **Push to `main`.** The workflow deploys `GerageCertificate`, `GerageEmail` and `Gerage`. The first run takes about
   15 minutes (certificate validation and CloudFront).
   On a fresh account, deploy `GerageEmail` first and wait until SES shows the domain as verified:
   Cognito refuses an unverified sender domain. SES must also be out of the sandbox to email anyone.
5. **Invite users** (see below) and, for local development, run `pnpm run deploy` once, or copy the
   values from the stack outputs into `apps/web/public/config.json`.

> **Don't run `cdk diff` on a stack that doesn't exist yet.** The diff leaves an empty stack in
> `REVIEW_IN_PROGRESS` that already has termination protection, which blocks the real deploy. If it
> happens, turn off termination protection on that empty stack and deploy again.

### Manual deploy

```sh
pnpm --filter @gerage/infra run diff   # preview changes
pnpm run deploy
```

### Invite a user

```sh
pnpm user:add ger@example.com
```

Cognito emails a temporary password from `no-reply@gerage.niklaskors.com` (via SES); the user picks a new
one at the first login. Each user gets their own
data file and can't see anyone else's. To reset passwords or disable users, use the AWS console
(Cognito → User pools).

## Local development

After one deploy (for `config.json`):

```sh
pnpm dev
```

The app runs at http://localhost:5173 and uses the deployed Cognito and data bucket.
