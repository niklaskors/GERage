import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

export type GithubDeployStackProps = StackProps & {
  /** e.g. niklaskors/GERage */
  repository: string;
  branch: string;
};

/**
 * Role that GitHub Actions assumes (via OIDC, no stored keys) to deploy the app.
 * Deployed by hand, not from GitHub, so the workflow can't change its own permissions.
 */
export class GithubDeployStack extends Stack {
  constructor(scope: Construct, id: string, props: GithubDeployStackProps) {
    super(scope, id, props);

    // The account already has GitHub's OIDC provider, and there can only be one.
    const provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      "GithubOidc",
      `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
    );

    const role = new iam.Role(this, "DeployRole", {
      roleName: "gerage-github-deploy",
      assumedBy: new iam.OpenIdConnectPrincipal(provider, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": `repo:${props.repository}:ref:refs/heads/${props.branch}`,
        },
      }),
    });

    // CDK deploys through the bootstrap roles, so that's all the role needs.
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`],
      }),
    );

    new CfnOutput(this, "DeployRoleArn", { value: role.roleArn });
  }
}
