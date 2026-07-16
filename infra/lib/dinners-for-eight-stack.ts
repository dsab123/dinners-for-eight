import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdaBase from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as path from "path";

/**
 * Config comes from CDK context so no secrets live in source control:
 *   npx cdk deploy \
 *     -c authSecret=... \
 *     -c mapboxToken=... \
 *     -c adminEmails=admin@church.org \
 *     -c fromEmail=noreply@church.org \
 *     -c resendApiKey=re_...
 *
 * The context values are read and validated in bin/app.ts and passed in via
 * `config` (so `cdk bootstrap` can run without them). See the repo root README
 * for details.
 */
export interface DinnersForEightStackProps extends cdk.StackProps {
  config: {
    authSecret: string;
    mapboxToken: string;
    fromEmail: string;
    resendApiKey: string;
    adminEmails: string;
    // Optional custom domain + its ACM cert ARN (must be in us-east-1 for
    // CloudFront). When both are set the distribution serves this domain and it
    // becomes the canonical app URL / CORS origin.
    siteDomain?: string;
    certArn?: string;
    // Optional human-readable dinner date for the group email (e.g.
    // "July 19, 2026"). Surfaces as the EVENT_DATE Lambda env var.
    eventDate?: string;
    // False on the bootstrap/ls paths, where CDK only wants to discover the
    // environment and no assets are built. When false we skip referencing the
    // frontend build dir so those commands work before `npm run build`.
    buildAssets: boolean;
  };
}

export class DinnersForEightStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DinnersForEightStackProps) {
    super(scope, id, props);

    const {
      authSecret,
      mapboxToken,
      fromEmail,
      resendApiKey,
      adminEmails,
      siteDomain,
      certArn,
      eventDate,
      buildAssets,
    } = props.config;

    // ---------- Data bucket (this is our "database") ----------
    const dataBucket = new s3.Bucket(this, "DataBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ---------- Static site bucket + CloudFront ----------
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // `siteDomain` may be a comma-separated list (e.g. apex + www). The cert
    // must cover every name listed here. Attach to the distribution only when
    // at least one domain AND a cert are supplied — keeping the domain config
    // in the stack so a redeploy can't silently drop a console-added alias.
    const siteDomains = (siteDomain ?? "")
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    const useCustomDomain = siteDomains.length > 0 && Boolean(certArn);
    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      defaultRootObject: "index.html",
      ...(useCustomDomain
        ? {
            domainNames: siteDomains,
            certificate: acm.Certificate.fromCertificateArn(
              this,
              "SiteCert",
              certArn!
            ),
          }
        : {}),
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: [
        // SPA client-side routing: unknown paths fall back to index.html
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
    });

    const cloudfrontUrl = `https://${distribution.distributionDomainName}`;
    const customOrigins = useCustomDomain
      ? siteDomains.map((d) => `https://${d}`)
      : [];
    // Canonical app URL: the first custom domain when configured, else
    // CloudFront's. Drives magic-link URLs (APP_URL) and the single-value
    // CORS origin the Lambdas echo back (ALLOWED_ORIGIN).
    const siteUrl = customOrigins[0] ?? cloudfrontUrl;

    // ---------- Shared Lambda environment ----------
    const sharedEnv = {
      DATA_BUCKET_NAME: dataBucket.bucketName,
      AUTH_SECRET: authSecret,
      MAPBOX_TOKEN: mapboxToken,
      ADMIN_EMAILS: adminEmails,
      FROM_EMAIL: fromEmail,
      RESEND_API_KEY: resendApiKey,
      APP_URL: siteUrl,
      ALLOWED_ORIGIN: siteUrl,
      EVENT_DATE: eventDate ?? "",
    };

    const backendDir = path.join(__dirname, "..", "..", "backend");
    const handlersDir = path.join(backendDir, "src", "handlers");

    const makeFn = (id: string, entryFile: string) =>
      new lambda.NodejsFunction(this, id, {
        entry: path.join(handlersDir, entryFile),
        handler: "handler",
        runtime: lambdaBase.Runtime.NODEJS_20_X,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: sharedEnv,
        projectRoot: backendDir,
        depsLockFilePath: path.join(backendDir, "package-lock.json"),
        bundling: { minify: true, sourceMap: false },
      });

    const requestMagicLinkFn = makeFn("RequestMagicLinkFn", "requestMagicLink.ts");
    const verifyMagicLinkFn = makeFn("VerifyMagicLinkFn", "verifyMagicLink.ts");
    const meFn = makeFn("MeFn", "me.ts");
    const geocodeFn = makeFn("GeocodeFn", "geocode.ts");
    const registerFn = makeFn("RegisterFn", "register.ts");
    const listRegistrationsFn = makeFn("ListRegistrationsFn", "listRegistrations.ts");
    const deleteRegistrationsFn = makeFn("DeleteRegistrationsFn", "deleteRegistrations.ts");
    const setForcedRoleFn = makeFn("SetForcedRoleFn", "setForcedRole.ts");
    const runMatchFn = makeFn("RunMatchFn", "runMatch.ts");
    const getMatchesFn = makeFn("GetMatchesFn", "getMatches.ts");
    const wipeDataFn = makeFn("WipeDataFn", "wipeData.ts");
    // Member lookup reads only the bundled directory JSON — no bucket access.
    const memberLookupFn = makeFn("MemberLookupFn", "memberLookup.ts");
    const simulateFn = makeFn("SimulateFn", "simulate.ts");
    const emailGroupsFn = makeFn("EmailGroupsFn", "emailGroups.ts");

    dataBucket.grantReadWrite(requestMagicLinkFn); // no-op read/write, harmless
    dataBucket.grantReadWrite(registerFn);
    dataBucket.grantReadWrite(listRegistrationsFn);
    dataBucket.grantReadWrite(deleteRegistrationsFn);
    dataBucket.grantReadWrite(setForcedRoleFn);
    dataBucket.grantReadWrite(runMatchFn);
    dataBucket.grantReadWrite(getMatchesFn);
    dataBucket.grantWrite(wipeDataFn);
    dataBucket.grantReadWrite(simulateFn);
    dataBucket.grantRead(emailGroupsFn);

    // Email is sent via Resend's HTTP API (see backend/src/lib/email.ts), so no
    // SES IAM permission is needed — the API key travels as a Lambda env var.

    // ---------- HTTP API ----------
    const httpApi = new apigw.HttpApi(this, "HttpApi", {
      corsPreflight: {
        // Allow every custom domain (apex, www, …), the raw CloudFront domain
        // (in case it's hit directly), and local dev. Deduped defensively.
        allowOrigins: Array.from(
          new Set([...customOrigins, cloudfrontUrl, "http://localhost:5173"])
        ),
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST],
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    const addRoute = (
      path: string,
      method: apigw.HttpMethod,
      fn: lambda.NodejsFunction
    ) => {
      httpApi.addRoutes({
        path,
        methods: [method],
        integration: new integrations.HttpLambdaIntegration(`${path}Integration`, fn),
      });
    };

    addRoute("/auth/request-link", apigw.HttpMethod.POST, requestMagicLinkFn);
    addRoute("/auth/verify", apigw.HttpMethod.POST, verifyMagicLinkFn);
    addRoute("/me", apigw.HttpMethod.GET, meFn);
    addRoute("/geocode", apigw.HttpMethod.GET, geocodeFn);
    addRoute("/registrations", apigw.HttpMethod.POST, registerFn);
    addRoute("/members/lookup", apigw.HttpMethod.GET, memberLookupFn);
    addRoute("/admin/registrations", apigw.HttpMethod.GET, listRegistrationsFn);
    addRoute("/admin/registrations/delete", apigw.HttpMethod.POST, deleteRegistrationsFn);
    addRoute("/admin/registrations/role", apigw.HttpMethod.POST, setForcedRoleFn);
    addRoute("/admin/match", apigw.HttpMethod.POST, runMatchFn);
    addRoute("/admin/match", apigw.HttpMethod.GET, getMatchesFn);
    addRoute("/admin/wipe", apigw.HttpMethod.POST, wipeDataFn);
    addRoute("/admin/simulate", apigw.HttpMethod.POST, simulateFn);
    addRoute("/admin/email-groups", apigw.HttpMethod.POST, emailGroupsFn);

    // ---------- Deploy the built frontend, wiring in the API URL ----------
    const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");

    // On bootstrap/ls (buildAssets === false) the frontend hasn't necessarily
    // been built yet, so reference an empty placeholder instead of the real
    // dist dir. A real deploy uses the actual build and still errors clearly if
    // it's missing (see README: run `npm run build` in frontend/ first).
    const siteSource = buildAssets
      ? s3deploy.Source.asset(frontendDist)
      : s3deploy.Source.data("index.html", "<!-- bootstrap placeholder -->");

    new s3deploy.BucketDeployment(this, "DeploySite", {
      sources: [
        siteSource,
        s3deploy.Source.data(
          "config.js",
          `window.__DINNERS_FOR_EIGHT_CONFIG__ = ${JSON.stringify({
            apiUrl: httpApi.apiEndpoint,
            mapboxToken: mapboxToken,
          })};`
        ),
      ],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    new cdk.CfnOutput(this, "SiteUrl", { value: siteUrl });
    new cdk.CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "DataBucketName", { value: dataBucket.bucketName });
  }
}
