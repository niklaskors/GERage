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
- **Backups:** the data bucket is versioned; old versions are kept for a year.

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

### First-time setup

The account is already [bootstrapped](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html) for CDK
in `eu-central-1` and `us-east-1`. Then, once:

```sh
pnpm --filter @gerage/infra run deploy:github-role   # the role GitHub Actions deploys with
pnpm run deploy                                      # first deploy, also writes config.json for local dev
```

The role stack is only deployed by hand, so the workflow can't change its own permissions.

### Manual deploy

```sh
pnpm --filter @gerage/infra run diff   # preview changes
pnpm run deploy
```

### Invite a user

```sh
aws cognito-idp admin-create-user --profile personal \
  --user-pool-id <UserPoolId from the deploy output> \
  --username ger@example.com \
  --user-attributes Name=email,Value=ger@example.com Name=email_verified,Value=true
```

Cognito emails a temporary password; the user picks a new one at the first login.

## Local development

After one deploy (for `config.json`):

```sh
pnpm dev
```

The app runs at http://localhost:5173 and uses the deployed Cognito and data bucket.
