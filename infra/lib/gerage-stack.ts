import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as identitypool from "aws-cdk-lib/aws-cognito-identitypool";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";
import { loginBrandingAssets, loginBrandingSettings } from "./login-branding";

const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../apps/web/dist");
const localOrigin = "http://localhost:5173";

export type GerageStackProps = StackProps & {
  /** The app's domain, e.g. gerage.niklaskors.com */
  domainName: string;
  /** The existing Route 53 hosted zone the domain lives in. */
  zoneName: string;
  /** Certificate for `domainName`, in us-east-1. */
  certificate: acm.ICertificate;
};

export class GerageStack extends Stack {
  constructor(scope: Construct, id: string, props: GerageStackProps) {
    super(scope, id, props);

    // --- Static hosting for the SPA ---
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      domainNames: [props.domainName],
      certificate: props.certificate,
      defaultRootObject: "index.html",
      // Let the SPA handle client-side routes.
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: "/index.html",
        ttl: Duration.seconds(0),
      })),
    });
    const appOrigin = `https://${props.domainName}`;

    const zone = route53.HostedZone.fromLookup(this, "Zone", { domainName: props.zoneName });
    const target = route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution));
    new route53.ARecord(this, "AliasRecord", { zone, recordName: props.domainName, target });
    new route53.AaaaRecord(this, "AliasRecordIPv6", { zone, recordName: props.domainName, target });

    // --- User data: one JSON file per user, the last 50 saves kept as versions ---
    const dataBucket = new s3.Bucket(this, "DataBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      // A rolling window of 50 versions: the current one plus the 49 before it. S3 only counts
      // versions together with an age, so older ones go once they've been replaced for a day.
      lifecycleRules: [{ noncurrentVersionExpiration: Duration.days(1), noncurrentVersionsToRetain: 49 }],
      cors: [
        {
          allowedOrigins: [appOrigin, localOrigin],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedHeaders: ["*"],
          // The app needs the ETag for conditional writes.
          exposedHeaders: ["ETag"],
        },
      ],
    });

    // --- Login: invite-only user pool with Cognito's managed login pages ---
    const userPool = new cognito.UserPool(this, "UserPool", {
      // Essentials is the cheapest plan that allows styling the managed login pages.
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      passwordPolicy: { minLength: 12 },
      // Sent from our own SES domain (see EmailStack) so the mails don't end up in spam.
      email: cognito.UserPoolEmail.withSES({
        fromEmail: `no-reply@${props.domainName}`,
        fromName: "GERage",
        sesRegion: this.region,
        sesVerifiedDomain: props.domainName,
      }),
      userInvitation: {
        emailSubject: "You're invited to GERage",
        emailBody: [
          "<p>Hi,</p>",
          "<p>You've been invited to GERage, the app to keep track of your cars and the kilometers you drive.</p>",
          `<p>Sign in at <a href="${appOrigin}">${props.domainName}</a> with:</p>`,
          "<p>Email: {username}<br>Temporary password: <b>{####}</b></p>",
          "<p>You'll choose your own password when you first sign in. The temporary password is valid for 7 days.</p>",
        ].join("\n"),
      },
      userVerification: {
        emailSubject: "Your GERage verification code",
        emailBody: "<p>Your GERage verification code is <b>{####}</b>.</p>",
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const domain = userPool.addDomain("Domain", {
      cognitoDomain: {
        domainPrefix: this.node.tryGetContext("domainPrefix") ?? `gerage-${this.account}`,
      },
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    const redirectUrls = [`${appOrigin}/`, `${localOrigin}/`];
    const userPoolClient = userPool.addClient("WebClient", {
      generateSecret: false,
      authFlows: {},
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
        callbackUrls: redirectUrls,
        logoutUrls: redirectUrls,
      },
      preventUserExistenceErrors: true,
    });

    // A client created through CloudFormation gets no managed login style, so it needs this one.
    const branding = new cognito.CfnManagedLoginBranding(this, "LoginBranding", {
      userPoolId: userPool.userPoolId,
      clientId: userPoolClient.userPoolClientId,
      settings: loginBrandingSettings,
      assets: loginBrandingAssets(),
    });
    branding.node.addDependency(domain);

    // --- Identity pool: trades the login token for AWS credentials scoped to the user's own folder ---
    const identityPool = new identitypool.IdentityPool(this, "IdentityPool", {
      allowUnauthenticatedIdentities: false,
      authenticationProviders: {
        userPools: [new identitypool.UserPoolAuthenticationProvider({ userPool, userPoolClient })],
      },
    });

    const userPrefix = "users/${cognito-identity.amazonaws.com:sub}";
    identityPool.authenticatedRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:PutObject"],
        resources: [dataBucket.arnForObjects(`${userPrefix}/*`)],
      }),
    );
    // Without ListBucket a missing file returns 403 instead of 404.
    identityPool.authenticatedRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["s3:ListBucket"],
        resources: [dataBucket.bucketArn],
        conditions: { StringLike: { "s3:prefix": [`${userPrefix}/*`] } },
      }),
    );

    // --- Deploy the SPA together with its runtime config ---
    const config = {
      region: this.region,
      userPoolId: userPool.userPoolId,
      userPoolClientId: userPoolClient.userPoolClientId,
      identityPoolId: identityPool.identityPoolId,
      cognitoDomain: domain.baseUrl(),
      dataBucket: dataBucket.bucketName,
    };

    new s3deploy.BucketDeployment(this, "DeploySite", {
      destinationBucket: siteBucket,
      sources: [s3deploy.Source.asset(webDist), s3deploy.Source.jsonData("config.json", config)],
      distribution,
      distributionPaths: ["/*"],
    });

    new CfnOutput(this, "AppUrl", { value: appOrigin });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    for (const [key, value] of Object.entries(config)) {
      new CfnOutput(this, `Config${key[0].toUpperCase()}${key.slice(1)}`, { value });
    }
  }
}
