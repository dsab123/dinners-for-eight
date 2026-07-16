#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DinnersForEightStack } from "../lib/dinners-for-eight-stack";

const app = new cdk.App();

const authSecret = app.node.tryGetContext("authSecret");
const mapboxToken = app.node.tryGetContext("mapboxToken");
const fromEmail = app.node.tryGetContext("fromEmail");
const resendApiKey = app.node.tryGetContext("resendApiKey");
const adminEmails = app.node.tryGetContext("adminEmails") ?? "";
// Optional custom domain for the site. When both are supplied, the CloudFront
// distribution serves this domain (and it becomes the canonical app URL /
// CORS origin). Omit them to fall back to the *.cloudfront.net domain.
//   -c siteDomain=dinnersforeight.food
//   -c certArn=arn:aws:acm:us-east-1:<acct>:certificate/<id>   (must be us-east-1)
const siteDomain = app.node.tryGetContext("siteDomain");
const certArn = app.node.tryGetContext("certArn");
// Optional human-readable dinner date shown in the group email (e.g.
// "July 19, 2026"). Omit to keep the generic "let's find a date" wording.
const eventDate = app.node.tryGetContext("eventDate");

// `cdk bootstrap` (and `cdk ls`) execute this app only to discover the target
// environment — they don't build assets and set an empty "bundling-stacks"
// list. `cdk synth`/`deploy` set it to ["**"]. So only require the deploy-time
// config when CDK actually intends to build/deploy the stack: that lets
// `cdk bootstrap` run with no `-c` args, while a real deploy still fails loudly
// if any config is missing. When it's not required we fall back to harmless
// placeholders (no assets are bundled and nothing is deployed on those paths).
const bundlingStacks: string[] =
  app.node.tryGetContext("aws:cdk:bundling-stacks") ?? [];
const willBuildOrDeploy = bundlingStacks.length > 0;

if (
  willBuildOrDeploy &&
  (!authSecret || !mapboxToken || !fromEmail || !resendApiKey)
) {
  throw new Error(
    "Missing required context values. Pass -c authSecret=... -c mapboxToken=... -c fromEmail=... -c resendApiKey=... (see README)."
  );
}

new DinnersForEightStack(app, "DinnersForEightStack", {
  config: {
    authSecret: authSecret ?? "BOOTSTRAP_PLACEHOLDER",
    mapboxToken: mapboxToken ?? "BOOTSTRAP_PLACEHOLDER",
    fromEmail: fromEmail ?? "bootstrap-placeholder@example.com",
    resendApiKey: resendApiKey ?? "BOOTSTRAP_PLACEHOLDER",
    adminEmails,
    siteDomain,
    certArn,
    eventDate,
    buildAssets: willBuildOrDeploy,
  },
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
});
