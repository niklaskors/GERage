import { App, Tags } from "aws-cdk-lib";
import { CertificateStack } from "../lib/certificate-stack.ts";
import { GithubDeployStack } from "../lib/github-deploy-stack.ts";
import { GerageStack } from "../lib/gerage-stack.ts";

const zoneName = "niklaskors.com";
const domainName = `gerage.${zoneName}`;
// Pinned so a deploy with credentials for any other account (e.g. a work one) fails.
const account = "833741619535";

const app = new App();

const certificateStack = new CertificateStack(app, "GerageCertificate", {
  env: { account, region: "us-east-1" },
  crossRegionReferences: true,
  terminationProtection: true,
  domainName,
  zoneName,
});

new GerageStack(app, "Gerage", {
  env: { account, region: "eu-central-1" },
  crossRegionReferences: true,
  terminationProtection: true,
  domainName,
  zoneName,
  certificate: certificateStack.certificate,
});

new GithubDeployStack(app, "GerageGithubDeploy", {
  env: { account, region: "eu-central-1" },
  terminationProtection: true,
  repository: "niklaskors/GERage",
  branch: "main",
});

// Marks every resource in the shared account as GERage's (also usable as a cost allocation tag).
Tags.of(app).add("project", "gerage");
