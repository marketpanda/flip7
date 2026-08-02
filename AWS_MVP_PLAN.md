# AWS Cloud MVP Plan

## Goal

Deploy the existing local card game to AWS, then add online rooms that can contain:

- anonymous/guest players;
- registered players;
- optional computer-controlled players;
- server-authoritative rounds, scores, and results.

The computer players will use a small rules-based strategy with controlled
randomness. They will not call an LLM, Bedrock, or any generative AI service.

This plan deliberately grows the application in small, working releases. Each
phase should be deployed and tested before the next phase begins.

## Recommended architecture

```text
                         AWS Cloud

 Browser ──HTTPS──> CloudFront ──> private S3 bucket
    │                 (Next.js static files)
    │
    ├──HTTPS commands──> API Gateway HTTP API
    │                         │
    │                         v
    │                  Lambda game service ──> DynamoDB
    │                         │                  rooms/state
    │                         ├───────────────> player profiles/stats
    │                         │
    │                         └───────────────> SQS bot-turn queue
    │
    └──WebSocket events──> API Gateway WebSocket API
                              │
                              ├── Lambda connect/disconnect handlers
                              └── DynamoDB connection records

 Registered users ──> Amazon Cognito user pool
 Guests ────────────> short-lived application guest sessions

 Logs, metrics, alarms ──> CloudWatch
 Infrastructure ─────────> AWS CDK in TypeScript
```

### Why this shape

- **S3 and CloudFront** are enough for the current client-only Next.js app.
- **HTTP API** handles commands such as create room, join, hit, and stay. HTTP
  gives each command a normal success/error response and is easy to test.
- **WebSocket API** only pushes updated room state and events. If it disconnects,
  the client reconnects and fetches the latest snapshot over HTTP.
- **Lambda and DynamoDB** avoid managing servers and are suitable for short,
  event-driven card-game operations.
- **Cognito** handles registered accounts. Guest sessions remain frictionless
  and do not create disposable Cognito users.
- **SQS** runs bot turns without making a human request wait through a long
  chain of bot decisions.
- **CDK** keeps every cloud resource in source control and uses the same
  TypeScript language as the game.

Do not introduce EC2, ECS, EKS/Kubernetes, RDS, Redis, a NAT Gateway, or Bedrock
for this MVP. They add cost and operations without solving a current need.

## Current-project assessment

The local application already has several properties that make this migration
straightforward:

- the route is currently client-only;
- game rules are separated into typed modules under `app/game`;
- the reducer is deterministic except for deck creation/shuffling;
- the automated tests cover the rule engine;
- no database, server route, or secret is currently required.

The key architectural change is that an online client must no longer own the
authoritative reducer state. For online games, the browser sends a command and
the Lambda service validates and applies it. Local pass-and-play can continue
to use the reducer in the browser.

## Hosting decision for Next.js 16

The repository currently uses Next.js 16.2.11. AWS Amplify Hosting's documented
managed Next.js SSR support currently lists Next.js versions only through 15.
For that reason, the first deployment will use a Next.js **static export**:

1. Add `output: "export"` to `next.config.ts`.
2. Set `images.unoptimized: true`, because the default `next/image` optimizer
   requires a Next.js server.
3. Run `npm run build`; Next.js writes deployable files to `out/`.
4. Put the contents of `out/` in a private S3 bucket.
5. Serve that bucket through CloudFront using Origin Access Control.

This app currently fits static export. Future API and authentication calls will
go directly to API Gateway, so they do not require Next.js API routes.

For room invitation links, initially use a query string such as
`https://game.example.com/?room=AB12CD`. This avoids dynamic-route fallback
configuration on static hosting.

## Delivery phases

### Phase 0 — AWS account safety and local readiness

**Outcome:** a safe AWS practice environment and a known-good local build.

1. Choose one AWS account for learning, preferably separate from important
   production workloads.
2. Enable MFA on the root user and do not use the root user for daily work.
3. Create an administrative user through IAM Identity Center for daily setup.
4. Select **ap-southeast-2 (Sydney)** as the main region. It is the closest
   standard AWS region to Perth for this project.
5. Create an AWS Budget with email alerts at small thresholds. A budget alerts
   you; it does not automatically stop all spending.
6. Enable Free Tier usage alerts and billing anomaly detection.
7. Install AWS CLI v2 and authenticate with an SSO/profile-based login. Do not
   put long-lived access keys in the repository.
8. Run locally:

   ```bash
   npm run lint
   npm run test
   npm run build
   ```

**Exit check:** MFA works, billing alerts have a confirmed email recipient, the
CLI can show the caller identity, and all three project checks pass.

### Phase 1 — Deploy the unchanged local game

**Outcome:** the pass-and-play MVP is available at an AWS HTTPS URL.

This first deployment uses two AWS services:

| AWS service | What it does | Where to open it |
| --- | --- | --- |
| **Amazon S3** | Privately stores the generated website files | AWS Console -> search `S3` |
| **Amazon CloudFront** | Gives the private files a public HTTPS address | AWS Console -> search `CloudFront` |

CloudFront is the public front door. S3 is private storage behind that front
door. Do not open the S3 bucket to the public and do not enable **S3 static
website hosting**.

#### Step 1.1 — Produce the website files locally

This step happens in the project, not in the AWS Console.

Update `next.config.ts`:

```ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["192.168.1.13"],
}

export default nextConfig
```

Then run:

```powershell
npm run lint
npm run test
npm run build
```

The build must create:

```text
D:\dev\card-game\out\
  index.html
  404.html
  _next\
  ...
```

Stop here if `out/index.html` does not exist.

#### Step 1.2 — Open AWS and select the region

1. Sign in to the [AWS Management Console](https://console.aws.amazon.com/).
2. In the region selector near the top-right, choose
   **Asia Pacific (Sydney) ap-southeast-2**.
3. Use the search box at the top of the console, search for **S3**, and open it.

S3 buckets live in a selected region. CloudFront is a global service, so its
console does not use the Sydney region in the same way.

#### Step 1.3 — Create the private S3 bucket

Inside the **Amazon S3** service:

1. Choose **General purpose buckets** in the left menu.
2. Choose **Create bucket**.
3. For **Bucket type**, choose **General purpose**.
4. Enter a globally unique lowercase name, for example:
   `card-game-dev-yourname-2026`.
5. For **AWS Region**, confirm
   **Asia Pacific (Sydney) ap-southeast-2**.
6. Under **Object Ownership**, keep
   **ACLs disabled (recommended)** / **Bucket owner enforced**.
7. Under **Block Public Access**, keep
   **Block all public access** selected.
8. For this practice deployment, enable **Bucket Versioning**. It makes
   accidental file replacement easier to recover from.
9. Keep the default S3-managed encryption setting.
10. Do not enable **Object Lock**.
11. Choose **Create bucket**.

The bucket must display **Objects can be public: No** or
**Block all public access: On**. Never disable that setting for this design.

#### Step 1.4 — Upload the exported website

Still inside **Amazon S3**:

1. Open the bucket that was just created.
2. Open the **Objects** tab.
3. Choose **Upload**.
4. Choose **Add files** and select all files directly inside
   `D:\dev\card-game\out`, including `index.html`.
5. Choose **Add folder** and select `D:\dev\card-game\out\_next`.
6. Choose **Add folder** again and select any other generated folders inside
   `out`, such as `_not-found`.
7. In the upload list, confirm it contains entries beginning with
   `_next/static/chunks/` before starting the upload.
8. Do **not** upload `out` as one enclosing folder. `index.html` must appear at
   the root of the bucket, not at `out/index.html`.
9. Keep the default permissions; do not grant public-read access.
10. Choose **Upload** and wait until every item reports success.

At this point, opening the S3 object URL in a browser should fail with an access
error. That is expected and proves the bucket is private.

#### Step 1.5 — Create CloudFront access to the private bucket

Open a new AWS Console tab:

1. Search for **CloudFront** and open the **Amazon CloudFront** service.
2. In the left menu, choose **Origin access**.
3. Choose **Create control setting**.
4. Name it `card-game-dev-oac`.
5. For **Origin type**, choose **S3**.
6. Keep **Sign requests (recommended)**.
7. Choose **Create**.

This Origin Access Control, abbreviated **OAC**, lets CloudFront sign its
requests to S3. It does not make the bucket public.

#### Step 1.6 — Create the CloudFront distribution

Inside **Amazon CloudFront**:

1. Choose **Distributions** in the left menu.
2. Choose **Create distribution**.
3. For the **Origin domain**, select the S3 bucket created in Step 1.3.
   Select the regular S3 bucket endpoint, not a `s3-website` endpoint.
4. Under **Origin access**, select
   **Origin access control settings (recommended)**.
5. Select `card-game-dev-oac`.
6. Keep the recommended origin settings.
7. Under the default cache behaviour:
   - **Viewer protocol policy:** Redirect HTTP to HTTPS;
   - **Allowed HTTP methods:** GET, HEAD;
   - **Compress objects automatically:** Yes;
   - **Cache policy:** CachingOptimized.
8. Do not attach AWS WAF for this first practice deployment.
9. Do not add a custom domain yet.
10. Choose **Create distribution**.

Distribution deployment can take several minutes. Copy these two values from
the distribution page:

```text
Distribution ID: for example E1ABCDEF234567
Distribution domain: for example d123example.cloudfront.net
```

#### Step 1.7 — Allow only that distribution to read S3

CloudFront might display a banner or button offering to copy/update the S3
bucket policy. If it offers **Copy policy**, copy it. Then:

1. Return to **Amazon S3**.
2. Open the game bucket.
3. Choose the **Permissions** tab.
4. Find **Bucket policy** and choose **Edit**.
5. Paste the policy generated by CloudFront.
6. Choose **Save changes**.

If CloudFront does not generate the policy in the console, use this template.
Replace all three placeholders; do not include angle brackets:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontToReadGameFiles",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::<BUCKET_NAME>/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::<AWS_ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
        }
      }
    }
  ]
}
```

Find the 12-digit AWS account ID from the account menu in the top-right of the
AWS Console. This policy grants read access to the named CloudFront distribution
only. **Block all public access stays enabled.**

#### Step 1.8 — Set `index.html` as the home page

Return to **Amazon CloudFront**:

1. Open **Distributions**.
2. Select the game distribution.
3. On the **General** or **Settings** tab, choose **Edit**.
4. Set **Default root object** to exactly `index.html`.
   Do not enter `/index.html`.
5. Save the changes and return to the **Distributions** list.
6. While CloudFront is updating, the **Last modified** column says
   **Deploying**. Deployment is finished when:
   - **Deploying** disappears and is replaced by a date and time; and
   - the separate **Status** column says **Enabled**.

The current CloudFront console does not necessarily leave a permanent
**Deployed** label visible. A normal date/time under **Last modified** means the
deployment has propagated.

#### Step 1.9 — Open and test the game

Open:

```text
https://<DISTRIBUTION_DOMAIN>
```

For example:

```text
https://d123example.cloudfront.net
```

Verify:

- the setup screen appears;
- all card images load;
- browser refresh still works;
- one full game completes on desktop;
- the site also works at a mobile viewport;
- the S3 object URL still returns Access Denied.

If CloudFront returns `403 Access Denied`, check these items in order:

1. `index.html` is at the bucket root;
2. the distribution's default root object is `index.html`, without `/`;
3. the distribution origin is the regular S3 bucket endpoint;
4. the OAC is attached to that origin;
5. the bucket policy has the correct bucket, account, and distribution IDs;
6. the distribution status is **Enabled** and **Last modified** shows a
   date/time rather than **Deploying**.

If the page opens but looks like unstyled HTML:

1. Open **Amazon S3** -> the game bucket -> **Objects**.
2. Confirm `_next` appears as a folder at the bucket root.
3. Open `_next` -> `static` -> `chunks`.
4. Confirm `.css` and `.js` objects exist there.
5. If they do not, repeat Step 1.4 using **Add folder** for `out\_next`.
6. After uploading, create a CloudFront invalidation for `/*`.

#### Step 1.10 — Deploy a later update

After changing the application:

1. Run `npm run lint`, `npm run test`, and `npm run build` again.
2. Open **Amazon S3** -> the game bucket -> **Objects** -> **Upload**.
3. Upload the contents of the new `out` directory and confirm replacement.
4. Open **Amazon CloudFront** -> **Distributions** -> the game distribution.
5. Open the **Invalidations** tab.
6. Choose **Create invalidation**.
7. Enter `/*` and create it.
8. Wait for the invalidation to complete, then reload the CloudFront URL.

Invalidations can incur charges above AWS's included allowance, so do not create
them repeatedly while experimenting.

#### Step 1.11 — Automate only after the manual deployment works

CDK means **AWS Cloud Development Kit**. It turns TypeScript code into an AWS
CloudFormation stack. Instead of clicking through S3 and CloudFront for every
environment, the code describes the resources and CDK creates or updates them.

CDK will create a **second** S3 bucket and CloudFront distribution. It does not
automatically take ownership of the resources made manually. Keep the manual
site working until the new CDK URL has been tested.

##### Step 1.11.1 — Confirm the prerequisites

Complete these checks in PowerShell from `D:\dev\card-game`:

```powershell
node --version
npm --version
aws --version
aws sts get-caller-identity --profile card-game-dev
```

Expected results:

- Node is at least the version required by `package.json`;
- AWS CLI v2 is installed;
- `get-caller-identity` returns the intended 12-digit AWS account ID;
- the ARN belongs to the intended practice account.

`card-game-dev` is the example AWS CLI profile throughout this section. Replace
it if the configured profile has a different name. If no profile has been
configured yet, create it with temporary AWS Console credentials.

First confirm AWS CLI is version 2.32.0 or newer:

```powershell
aws --version
```

Then create and sign in to the profile:

```powershell
aws login --profile card-game-dev --region ap-southeast-2
```

The command opens an AWS sign-in page in the browser. Sign in to the intended
practice account and approve the local-development session. If the browser
cannot return to the CLI automatically, use:

```powershell
aws login --remote --profile card-game-dev --region ap-southeast-2
```

Persist the default deployment region in the new profile. Some AWS CLI versions
use `--region` for the login request without saving it to the profile:

```powershell
aws configure set region ap-southeast-2 --profile card-game-dev
aws configure set output json --profile card-game-dev
```

The login uses temporary credentials rather than storing long-lived access
keys. The session can last for up to 12 hours; run `aws login` again after it
expires.

Confirm that the profile now exists and resolves to the correct account:

```powershell
aws configure list-profiles
aws configure list --profile card-game-dev
aws sts get-caller-identity --profile card-game-dev
```

If `aws login` is unavailable, update AWS CLI v2. If the account is managed
through IAM Identity Center, use `aws configure sso --profile card-game-dev`
and `aws sso login --profile card-game-dev` instead.

Copy the 12-digit `Account` value returned by `get-caller-identity`. It will be
used during bootstrapping.

##### Step 1.11.2 — Create the TypeScript CDK project

An AWS CDK project must be initialized in an empty directory. From the project
root:

```powershell
New-Item -ItemType Directory -Path infra
Set-Location infra
npx aws-cdk init app --language typescript
```

`npx` may ask permission to download the CDK CLI the first time. The command
creates a structure similar to:

```text
infra/
  bin/
    infra.ts
  lib/
    infra-stack.ts
  test/
  cdk.json
  package.json
  tsconfig.json
```

The generated project installs `aws-cdk-lib` and `constructs`. Use the local
CDK command through `npx aws-cdk`; a global CDK installation is not required.

Check it:

```powershell
npm run build
npx aws-cdk --version
```

##### Step 1.11.3 — Set the account and Sydney region

Open `infra/bin/infra.ts` and make the stack declaration explicit:

```ts
#!/usr/bin/env node
import * as cdk from "aws-cdk-lib"
import { InfraStack } from "../lib/infra-stack"

const app = new cdk.App()

new InfraStack(app, "CardGameFrontendDev", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-southeast-2",
  },
})
```

The stack name shown in AWS CloudFormation will be
`CardGameFrontendDev`. The profile supplied to CDK determines
`CDK_DEFAULT_ACCOUNT`; the region is pinned to Sydney.

##### Step 1.11.4 — Bootstrap the account and region once

CDK needs a small support stack for staging deployment files. From `infra`,
replace `<AWS_ACCOUNT_ID>` with the 12-digit account ID:

```powershell
npx aws-cdk bootstrap aws://<AWS_ACCOUNT_ID>/ap-southeast-2 --profile card-game-dev
```

Example shape only:

```powershell
npx aws-cdk bootstrap aws://123456789012/ap-southeast-2 --profile card-game-dev
```

Do not copy the example account number.

This creates a CloudFormation stack named `CDKToolkit`, including an asset
bucket and deployment roles. Bootstrapping is normally required only once for
each AWS account/region combination.

Verify it in the AWS Console:

1. Select **Asia Pacific (Sydney) ap-southeast-2**.
2. Search for **CloudFormation**.
3. Open **Stacks**.
4. Confirm `CDKToolkit` has status `CREATE_COMPLETE` or `UPDATE_COMPLETE`.

Stop if bootstrap fails. Do not continue with a partially configured account.

##### Step 1.11.5 — Define the automated frontend resources

Replace the generated contents of `infra/lib/infra-stack.ts` with:

```ts
import * as path from "path"
import * as cdk from "aws-cdk-lib"
import { Construct } from "constructs"
import * as cloudfront from "aws-cdk-lib/aws-cloudfront"
import * as origins from "aws-cdk-lib/aws-cloudfront-origins"
import * as s3 from "aws-cdk-lib/aws-s3"
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment"

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    const distribution = new cloudfront.Distribution(
      this,
      "WebsiteDistribution",
      {
        defaultRootObject: "index.html",
        defaultBehavior: {
          origin:
            origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
    )

    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "..", "..", "out")),
      ],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ["/*"],
      prune: true,
    })

    new cdk.CfnOutput(this, "WebsiteUrl", {
      value: `https://${distribution.distributionDomainName}`,
    })

    new cdk.CfnOutput(this, "WebsiteBucketName", {
      value: websiteBucket.bucketName,
    })

    new cdk.CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
    })
  }
}
```

What this code creates:

| Code | AWS result |
| --- | --- |
| `s3.Bucket` | Private, encrypted, versioned S3 bucket |
| `withOriginAccessControl` | CloudFront OAC and private bucket permission |
| `cloudfront.Distribution` | Public HTTPS CloudFront address |
| `BucketDeployment` | Uploads `out/` and invalidates CloudFront |
| `CfnOutput` | Prints the URL, bucket name, and distribution ID |

The bucket has no hard-coded name. AWS/CDK generates a globally unique physical
name. `RemovalPolicy.RETAIN` prevents an accidental `cdk destroy` from deleting
the stored site files immediately.

##### Step 1.11.6 — Build the application before CDK

CDK packages `D:\dev\card-game\out` during deployment. It must exist and must
contain the latest application.

Return to the repository root and run:

```powershell
Set-Location ..
npm run lint
npm run test
npm run build
Test-Path .\out\index.html
```

The last command must print:

```text
True
```

If it prints `False`, do not deploy. Fix the Next.js build first.

##### Step 1.11.7 — Build and synthesize the CDK project

Return to `infra`:

```powershell
Set-Location infra
npm run build
npx aws-cdk list --profile card-game-dev
npx aws-cdk synth --profile card-game-dev
```

Expected stack list:

```text
CardGameFrontendDev
```

`synth` creates a generated CloudFormation template under `infra/cdk.out`.
Do not manually edit files inside `cdk.out`; CDK regenerates them.

##### Step 1.11.8 — Preview the AWS changes

Run:

```powershell
npx aws-cdk diff CardGameFrontendDev --profile card-game-dev
```

For the first deployment, the diff should contain additions for:

- an S3 bucket;
- CloudFront distribution and OAC;
- bucket policy;
- deployment custom resource and supporting permissions;
- CloudFormation outputs.

Read the diff before proceeding. Stop if it targets the wrong account/region or
shows deletion/replacement of an unexpected resource.

##### Step 1.11.9 — Deploy

Run:

```powershell
npx aws-cdk deploy CardGameFrontendDev `
  --profile card-game-dev `
  --require-approval broadening
```

CDK displays the target environment before deployment. Confirm it is the
intended account and `ap-southeast-2`.

When prompted about security-sensitive changes, read the list and approve only
if it matches this plan. Do not add `--require-approval never` while learning.

The deployment runs through AWS CloudFormation and can take several minutes,
mostly because of CloudFront. A successful deployment ends with outputs similar
to:

```text
CardGameFrontendDev.WebsiteUrl = https://d123example.cloudfront.net
CardGameFrontendDev.WebsiteBucketName = ...
CardGameFrontendDev.DistributionId = ...
```

##### Step 1.11.10 — Verify the CDK deployment

1. Open the printed `WebsiteUrl`.
2. Complete a game and confirm CSS, JavaScript, fonts, and card images load.
3. Refresh the page.
4. Test a mobile viewport.
5. In **CloudFormation**, open `CardGameFrontendDev` and confirm
   `CREATE_COMPLETE` or `UPDATE_COMPLETE`.
6. In **S3**, open the generated bucket and confirm **Block all public access**
   remains on.
7. Confirm a direct S3 object URL returns Access Denied.
8. In **CloudFront**, confirm the new distribution is **Enabled** and
   **Last modified** shows a date/time rather than **Deploying**.

The CDK URL is separate from the earlier manual CloudFront URL. Test the CDK
URL, not the old one.

##### Step 1.11.11 — Deploy future application updates

For every application update:

```powershell
Set-Location D:\dev\card-game
npm run lint
npm run test
npm run build
Set-Location infra
npm run build
npx aws-cdk diff CardGameFrontendDev --profile card-game-dev
npx aws-cdk deploy CardGameFrontendDev `
  --profile card-game-dev `
  --require-approval broadening
```

`BucketDeployment` uploads the new `out/` contents, removes obsolete deployed
objects because `prune` is enabled, and creates the CloudFront invalidation.
There is no separate S3 upload or invalidation click.

##### Step 1.11.12 — Understand rollback

CDK deploys through CloudFormation. By default, a failed infrastructure update
rolls the stack back to its previous stable infrastructure configuration. Do
not use `--no-rollback` for this project.

Application files require a deliberate content rollback:

1. select the last known-good Git commit or release;
2. rebuild its static export;
3. run the same CDK deployment;
4. smoke-test the URL again.

S3 versioning is an additional recovery aid, but redeploying a known-good
release is the normal rollback method.

##### Step 1.11.13 — Retire the manual deployment safely

Do this only after the CDK URL passes all checks:

1. Record the manual and CDK distribution IDs and bucket names so they are not
   confused.
2. Keep the manual site for a short verification period.
3. Use the CDK site as the active development URL.
4. Disable the **manual** CloudFront distribution.
5. Wait until its **Last modified** field becomes a date/time.
6. Verify the CDK URL still works.
7. Delete the disabled manual distribution.
8. Only then empty and delete the **manual** S3 bucket.
9. Keep the CDK-created resources; CloudFormation now manages them.

Deleting the manual resources is destructive. Re-check their IDs and names
against the CloudFormation `CardGameFrontendDev` resource list before deleting
anything. Never edit or delete a CDK-managed resource manually unless following
a documented recovery procedure.

##### Step 1.11.14 — Know what appears in the AWS Console

After this automation is complete, these resources are expected:

- **CloudFormation -> `CDKToolkit`:** shared CDK deployment support;
- **CloudFormation -> `CardGameFrontendDev`:** the website infrastructure;
- **S3:** the private website bucket plus the CDK bootstrap asset bucket;
- **CloudFront:** the CDK-managed distribution and OAC;
- **Lambda/IAM:** support resources used by the CDK bucket-deployment custom
  resource.

Seeing support resources does not mean that the game itself runs in Lambda. The
game is still static at this phase; Lambda is only helping CloudFormation copy
the files during deployment.

**Exit check:** refreshing the site works, images load, a full game completes,
and the S3 bucket is not public.

### Phase 2 — Guest rooms and server-authoritative games

**Outcome:** two browsers can join one room as guests and finish a match.

Start with guest users only so multiplayer and authentication are not debugged
at the same time.

#### AWS-006 — Shared API contracts and extracted game engine

**Outcome:** the browser and the future Lambda service can import the same game
rules and request/response types without importing React, Next.js, or AWS code.

Complete this ticket before creating the DynamoDB tables or HTTP Lambdas. This
is a local refactor only; it does not create or change any AWS resources.

##### Step 6.1 — Make a clean checkpoint

Confirm the CDK frontend deployment has passed the Phase 1 exit check. From the
repository root, inspect the current work:

```powershell
Set-Location D:\dev\card-game
git status --short
```

Commit the completed Phase 1/CDK work before starting this refactor, or at
least record which changes belong to Phase 1. Do not mix incomplete CDK edits
with the game-engine extraction.

Because this repository uses Next.js 16, read the locally installed guides
that apply to the import and project-structure changes before editing code:

```powershell
Get-Content -Raw node_modules\next\dist\docs\01-app\01-getting-started\02-project-structure.md
Get-Content -Raw node_modules\next\dist\docs\01-app\03-api-reference\05-config\02-typescript.md
```

Run the existing checks once to establish a known-good starting point:

```powershell
npm run lint
npm run test
npm run build
```

Stop and fix any existing failure before moving files.

##### Step 6.2 — Create the shared package folders

Create these source folders at the repository root:

```text
packages/
  game-engine/
  contracts/
```

For this first extraction, these are source-code folders inside the existing
root TypeScript project. Do not add npm workspaces, publishable packages, or a
second copy of React. The root `tsconfig.json` already includes TypeScript files
under `packages`.

The dependency direction must remain:

```text
app --------------------> packages/game-engine
app --------------------> packages/contracts
future Lambda service --> packages/game-engine
future Lambda service --> packages/contracts
```

Neither shared package may import from `app`, `infra`, React, Next.js, or the
AWS SDK.

##### Step 6.3 — Move the pure game engine

Move these existing files without changing their behaviour yet:

```text
app/game/cards.ts       -> packages/game-engine/cards.ts
app/game/reducer.ts     -> packages/game-engine/reducer.ts
app/game/rules.ts       -> packages/game-engine/rules.ts
app/game/types.ts       -> packages/game-engine/types.ts
app/game/game.test.ts   -> packages/game-engine/game.test.ts
```

Use `git mv` so Git can recognize the files as moves:

```powershell
New-Item -ItemType Directory -Force packages\game-engine
New-Item -ItemType Directory -Force packages\contracts
git mv app\game\cards.ts packages\game-engine\cards.ts
git mv app\game\reducer.ts packages\game-engine\reducer.ts
git mv app\game\rules.ts packages\game-engine\rules.ts
git mv app\game\types.ts packages\game-engine\types.ts
git mv app\game\game.test.ts packages\game-engine\game.test.ts
```

Add `packages/game-engine/index.ts` as the public entry point. Re-export the
functions and types that clients and Lambdas are allowed to use:

```ts
export * from "./cards"
export * from "./reducer"
export * from "./rules"
export * from "./types"
```

Keep card artwork and UI components under `app`; only rules, state types, deck
creation, scoring, and reducer behaviour belong in the engine.

##### Step 6.4 — Give online players stable IDs

The current `createGame(names)` function creates player IDs internally. An
online room needs to assign a player ID when the player joins and preserve it
when the match starts.

Add an engine input type and a second constructor:

```ts
export interface GamePlayerInput {
  id: string
  name: string
}

export function createGameForPlayers(
  inputs: GamePlayerInput[],
  deck?: Card[],
): GameState
```

`createGameForPlayers` must use the supplied IDs. Keep the existing
`createGame(names)` function as a wrapper that generates IDs for local
pass-and-play mode, so the current browser experience does not change.

Add tests proving that:

1. supplied player IDs are preserved;
2. the supplied player order is preserved;
3. local `createGame(names)` still creates unique IDs;
4. a supplied deterministic deck is used unchanged.

Do not add DynamoDB fields, session tokens, room versions, or WebSocket state to
`GameState`. Those belong to the service layer, not the rules engine.

##### Step 6.5 — Update browser imports and tests

Replace imports such as:

```ts
import { gameReducer } from "../game/reducer"
```

with imports through the shared entry point:

```ts
import { gameReducer } from "@/packages/game-engine"
```

Update `GameApp.tsx`, `PlayerPanel.tsx`, and `CardFace.tsx`. Internal files
inside `packages/game-engine` may continue using relative imports.

The root test script currently searches only under `app`. Update it in
`package.json` from:

```json
"test": "vitest run app"
```

to:

```json
"test": "vitest run app packages"
```

Run this intermediate check:

```powershell
npm run test
npm run lint
```

Remove the empty `app/game` directory only after no import references it:

```powershell
rg "app/game|\.\./game|\./game" app packages
```

An empty directory does not need a Git operation because Git does not track
empty folders.

##### Step 6.6 — Define shared HTTP contracts

Add `packages/contracts/http.ts` with TypeScript types for the six planned HTTP
routes. At minimum, define:

```text
CreateGuestSessionResponse
CreateRoomRequest
JoinRoomRequest
RoomCommandRequest
CreateSocketTicketResponse
ApiErrorResponse
```

Use a discriminated union for commands so each command has the correct payload:

```ts
export type RoomCommandRequest =
  | {
      commandId: string
      expectedVersion: number
      type: "start" | "hit" | "stay" | "next-round"
      payload: Record<string, never>
    }
  | {
      commandId: string
      expectedVersion: number
      type: "target"
      payload: { targetId: string }
    }
  | {
      commandId: string
      expectedVersion: number
      type: "leave"
      payload: Record<string, never>
    }
```

Add `packages/contracts/room.ts` for the public room snapshot. It should include
the room ID, version, status, public players, visible game state, deck count,
and discard count. It must not contain:

- the ordered deck or full discard pile;
- session tokens or token hashes;
- guest/session identity used for authorization;
- processed command IDs;
- WebSocket connection IDs;
- DynamoDB implementation details.

Add `packages/contracts/index.ts`:

```ts
export * from "./http"
export * from "./room"
```

These TypeScript types provide compile-time contracts. Runtime request
validation will be added at the Lambda boundary in AWS-008; never assume an
incoming JSON body is valid merely because a TypeScript type exists.

##### Step 6.7 — Add the sanitization boundary

Define the public snapshot type now, but place the actual `sanitizeRoom`
function in the future game service during AWS-008. The sanitizer needs access
to the internal room record, which is server-only and does not belong in the
browser or pure engine package.

The intended boundary is:

```text
DynamoDB RoomItem (private)
        |
        v
sanitizeRoom(room)
        |
        v
PublicRoomSnapshot (safe for browser/WebSocket)
```

Write a contract-level type test or fixture showing the expected public JSON.
When the service sanitizer is implemented, add a runtime test that asserts the
serialized response does not contain `deck`, `sessionHash`, `processedCommandIds`,
or `connectionId`.

##### Step 6.8 — Verify and stop at the AWS-006 boundary

From the repository root, run:

```powershell
npm run lint
npm run test
npm run build
Test-Path .\out\index.html
git status --short
```

The last build check must print `True`. Smoke-test local pass-and-play and
confirm one complete game still works exactly as before.

**AWS-006 exit check:** shared engine tests pass from `packages/game-engine`,
the existing browser imports the shared engine, stable supplied player IDs are
tested, shared HTTP/public-room contract types compile, the static export still
builds, and no AWS resource was created or changed.

Stop here before AWS-007. The HTTP routes below describe the target API; they
are not created until the tables and Lambda handlers exist.

#### HTTP endpoints

```text
POST /sessions/guest             Create a short-lived guest session
POST /rooms                      Create a room
POST /rooms/{roomId}/join        Join with a display name
GET  /rooms/{roomId}             Fetch the latest sanitized snapshot
POST /rooms/{roomId}/commands    Submit hit, stay, target, start, or leave
POST /rooms/{roomId}/socket-ticket
                                 Get a one-use, short-lived WebSocket ticket
```

Every command should contain:

```json
{
  "commandId": "unique-client-generated-id",
  "expectedVersion": 12,
  "type": "hit",
  "payload": {}
}
```

The service must:

1. resolve the session to a player;
2. verify that the player belongs to the room;
3. verify that the command is allowed in the current phase;
4. verify that it is that player's turn when applicable;
5. reject duplicate `commandId` values;
6. apply the shared game engine;
7. conditionally write version 13 only if version 12 still exists;
8. return a conflict response when another command won the race;
9. broadcast the sanitized new snapshot.

The server creates and shuffles the deck. Never send the remaining deck order
to clients.

#### Guest identity

- `POST /sessions/guest` returns a cryptographically random opaque session
  token.
- Store only a hash of that token in DynamoDB.
- Store the raw token in browser session/local storage, not in a URL.
- Give the session an expiry and a DynamoDB TTL.
- Before opening a WebSocket, exchange the session for a one-use socket ticket.
  A browser WebSocket cannot reliably add a custom authorization header, so the
  short-lived ticket can be put in the connection query string without exposing
  the long-lived guest credential.
- The `$connect` Lambda authorizer validates and consumes the ticket.

Guest players can play and keep scores inside the room. Guest stats do not
survive after the room/session expires.

#### DynamoDB tables for the first online slice

Keep the model understandable by using three tables initially:

| Table | Partition key | Purpose |
| --- | --- | --- |
| `Rooms` | `roomId` | Authoritative game snapshot, version, host, status, expiry |
| `Sessions` | `sessionHash` | Guest identity, expiry, optional registered user ID |
| `Connections` | `connectionId` | Socket connection, room/player IDs, expiry |

Implement the tables in these steps:

1. Create `Rooms` with `roomId` as its string partition key.
2. Create `Sessions` with `sessionHash` as its string partition key.
3. Create `Connections` with `connectionId` as its string partition key.
4. Set all three tables to DynamoDB on-demand capacity
   (`BillingMode.PAY_PER_REQUEST` in CDK).
5. Add an `expiresAt` TTL attribute to all three tables. Store it as Unix epoch
   seconds.
6. Store abandoned-room expiry on each `Rooms` item.
7. Store guest-session and socket-ticket expiry on the applicable `Sessions`
   items.
8. Store stale-connection expiry on each `Connections` item.
9. Add a Global Secondary Index named `roomId-index` to `Connections`, using
   `roomId` as its partition key.
10. In the broadcast Lambda, query `roomId-index` with the current room ID to
    get every connection that should receive the update.
11. If sending to a connection returns `GoneException`, delete that
    `Connections` item.

Implement the broadcast on AWS as follows:

1. Create a Lambda named `BroadcastRoomUpdate`.
2. Give it the `Connections` table name, `roomId-index` index name, and
   WebSocket API callback URL as environment variables.
3. Grant it permission to:
   - query `Connections/roomId-index`;
   - delete stale items from `Connections`;
   - call API Gateway's `execute-api:ManageConnections` action.
4. After the command Lambda successfully saves a new room version, invoke
   `BroadcastRoomUpdate` with the `roomId` and sanitized room snapshot.
5. In `BroadcastRoomUpdate`, call DynamoDB `Query` with:

   ```text
   TableName: Connections table name
   IndexName: roomId-index
   KeyConditionExpression: roomId = :roomId
   ```

6. Loop over the returned `connectionId` values and call API Gateway
   `PostToConnection` once for each connection.
7. If the query returns `LastEvaluatedKey`, query the next page and continue
   until no key remains.
8. If `PostToConnection` returns `GoneException`, delete that connection from
   `Connections` and continue notifying the other players.

TTL deletion is asynchronous, so application code must still reject an item
whose expiry time has passed. After reading an item, compare `expiresAt` with
the current Unix time before using it:

```ts
const now = Math.floor(Date.now() / 1000)

if (item.expiresAt <= now) {
  // Reject the room, session, ticket, or connection as expired.
}
```

Apply this check whenever a Lambda loads a room, validates a guest session,
consumes a socket ticket, or broadcasts to stored connections. Test both an
active item and an expired item that DynamoDB has not deleted yet.

#### Prerequisites for the two-browser exit check

Creating the DynamoDB tables does not yet provide create/join functionality.
Complete the following steps in order before running the exit check.

##### Step 1 — Finish and verify DynamoDB

1. Confirm `Rooms`, `Sessions`, and `Connections` exist.
2. Confirm all three use on-demand capacity.
3. Confirm all three use `expiresAt` as their TTL attribute.
4. Confirm `Connections` has an active `roomId-index` GSI.
5. Add one temporary connection item and verify that querying
   `roomId-index` by its `roomId` returns it. Delete the temporary item.

At this point there is still no browser create/join flow.

##### Step 2 — Implement the HTTP Lambdas

Do not create all six functions with untouched defaults. Create and test them
one at a time, starting with `CreateGuestSession`. Use this common MVP
configuration:

```text
Runtime:       Node.js 24.x
Architecture: x86_64 (the default is fine)
Memory:       256 MB
Timeout:      10 seconds
VPC:          none
Execution role:
  AWSLambdaBasicExecutionRole plus access to only the required tables
```

The default execution role permits CloudWatch logging but does not give the
function permission to read or write DynamoDB. Add a small inline IAM policy
for the required table actions; do not use DynamoDB full access.

Configure each function as follows:

| Function | Environment variables | Required DynamoDB actions |
| --- | --- | --- |
| `CreateGuestSession` | `SESSIONS_TABLE_NAME` | `PutItem` on `Sessions` |
| `CreateRoom` | `SESSIONS_TABLE_NAME`, `ROOMS_TABLE_NAME` | `GetItem` on `Sessions`; `PutItem` on `Rooms` |
| `JoinRoom` | `SESSIONS_TABLE_NAME`, `ROOMS_TABLE_NAME` | `GetItem` on `Sessions`; `GetItem` and conditional `UpdateItem` on `Rooms` |
| `GetRoom` | `SESSIONS_TABLE_NAME`, `ROOMS_TABLE_NAME` | `GetItem` on `Sessions` and `Rooms` |
| `SubmitCommand` | `SESSIONS_TABLE_NAME`, `ROOMS_TABLE_NAME` | `GetItem` on both tables; conditional `UpdateItem` on `Rooms` |
| `CreateSocketTicket` | `SESSIONS_TABLE_NAME` | `GetItem` and `PutItem` on `Sessions` |

Use the exact deployed DynamoDB table names as the environment-variable
values. No API Gateway URL or WebSocket callback URL is needed yet.

Then implement and deploy these handlers:

1. `CreateGuestSession` creates a guest token, stores only its hash in
   `Sessions`, and returns the raw token to the browser.
2. `CreateRoom` validates the guest session, creates a room in `Rooms`, adds
   the host as the first player, and returns the room code.
3. `JoinRoom` validates the guest session, adds the guest to an existing room,
   and returns the updated sanitized room state.
4. `GetRoom` validates the guest session and returns the latest sanitized room
   state without exposing the deck order.
5. `SubmitCommand` validates the player and room version, applies one game
   action on the server, and conditionally saves the next room version.
6. `CreateSocketTicket` validates the guest session and creates a short-lived,
   one-use ticket for the WebSocket connection.

Give each Lambda its required table names as environment variables and grant
only the DynamoDB read/write actions it needs. Reuse one shared expiry-check
function in every handler.

Test these Lambdas directly before adding API Gateway. Use Lambda console test
events or automated tests to confirm that two different guest sessions can
create and join the same room.

##### Step 3 — Create the HTTP API Gateway

1. Create an API Gateway HTTP API.
2. Integrate each route with its matching Lambda:

   ```text
   POST /sessions/guest
   POST /rooms
   POST /rooms/{roomId}/join
   GET  /rooms/{roomId}
   POST /rooms/{roomId}/commands
   POST /rooms/{roomId}/socket-ticket
   ```

3. Create and deploy a `dev` stage.
4. Enable CORS for `http://localhost:3000` during local development.
5. Copy the deployed HTTP API URL.
6. Call every route with an API client such as Postman or `curl`. Do not start
   frontend work until create, join, get-room, and commands work through the
   deployed API.

##### Step 4 — Create the WebSocket API Gateway

1. Create an API Gateway WebSocket API.
2. Add a `$connect` Lambda that:
   - receives the socket ticket;
   - rejects an unknown, consumed, or expired ticket;
   - stores `connectionId`, `roomId`, `playerId`, and `expiresAt` in
     `Connections`.
3. Add a `$disconnect` Lambda that deletes the connection item.
4. Create and deploy a `dev` WebSocket stage.
5. Copy both stage endpoints:

   ```text
   Browser connection URL: wss://{api-id}.execute-api.{region}.amazonaws.com/dev
   Lambda callback URL:    https://{api-id}.execute-api.{region}.amazonaws.com/dev
   ```

6. Configure `BroadcastRoomUpdate` with:

   ```text
   CONNECTIONS_TABLE_NAME
   CONNECTIONS_INDEX_NAME
   WEBSOCKET_CALLBACK_URL
   ```

7. Grant it permission to query the index, delete stale connections, and call
   `execute-api:ManageConnections`.
8. Make `SubmitCommand` invoke the broadcast after it successfully saves a new
   room version.
9. Test with two raw WebSocket clients and confirm that a room update reaches
   both connections.

##### Step 5 — Implement the frontend room flow

The current frontend is local pass-and-play only. Add:

1. A landing screen with **Create room** and **Join room** choices.
2. Guest-session creation and storage in the browser.
3. A create-room form that displays the returned room code.
4. A join-room form that accepts a room code and display name.
5. An online game screen that renders the sanitized server state.
6. Command requests that send `commandId` and `expectedVersion`.
7. WebSocket connection, reconnect, and missed-version recovery using
   `GET /rooms/{roomId}`.
8. Local configuration containing the deployed HTTP and WebSocket URLs.

Run the frontend at `http://localhost:3000` and verify that one normal browser
window can create a room and one incognito window can join it. Only then run
the full exit check.

#### Phase 2 exit check

1. Open two private/incognito browser windows.
2. In window A, create a room and copy its room code.
3. In window B, join using that room code.
4. Start the game and confirm both windows show the same state.
5. Take turns playing from both windows until the state changes several times.
6. Close window B, then make another move in window A.
7. Reopen window B and reconnect to the room.
8. Confirm window B reloads the latest state from the server.
9. Continue playing from both windows until the game finishes.
10. Confirm both windows show the same winner and final scores.

### Phase 3 — Computer players

**Outcome:** a room can contain any supported mix of humans and bots.

Treat a bot exactly like another player in game state, but never give it a
session or WebSocket connection.

The first strategy can be small and explainable:

1. Inspect the bot's unique number cards.
2. Estimate duplicate risk from the known deck composition and cards already
   revealed.
3. Compare current round points with:
   - a configurable risk threshold;
   - distance from the winning score;
   - the leading opponent's score;
   - how many unique numbers are needed for Flip 7.
4. Add a small random adjustment so identical situations do not always make the
   same choice.
5. Choose hit or stay.
6. Pick legal action-card targets using simple priorities plus randomness.

Example difficulty profiles:

| Level | Behaviour |
| --- | --- |
| Easy | Large random component; often takes too much or too little risk |
| Normal | Uses duplicate probability and current score |
| Hard | Also adjusts for match position and opponents |

After a state transition leaves a bot active, enqueue `{roomId, version}` in
SQS. A bot-turn Lambda reads the current room, ignores stale messages, chooses
one legal action, conditionally updates the room, broadcasts the result, and
queues another message only if the next turn also belongs to a bot.

Put a dead-letter queue on the bot queue. This prevents one broken room from
retrying forever.

For repeatable tests, inject the random-number function or a seed. Do not use
`Math.random()` directly inside strategy tests.

**Exit check:** one human can complete games against bots at every difficulty,
and bot turns cannot act twice after duplicate/stale SQS delivery.

### Phase 4 — Registered accounts and persistent scoring

**Outcome:** registration is optional, while signed-in users keep statistics.

1. Create an Amazon Cognito user pool.
2. Start with Cognito managed login instead of building password forms.
3. Support email sign-up, verification, sign-in, sign-out, and password reset.
4. Add the Cognito domain and application callback/logout URLs.
5. Use authorization code flow with PKCE for the browser client.
6. Verify Cognito JWTs in the API authorizer.
7. Continue accepting opaque guest sessions through the same authorizer.
8. Let a signed-in user claim their current guest player only after proving
   both identities; never merge accounts solely by display name.
9. Add a `Profiles` table keyed by Cognito `sub`.

Suggested persistent profile fields:

```text
userId
displayName
gamesPlayed
gamesWon
totalMatchPoints
highestMatchScore
createdAt
updatedAt
```

Keep three score concepts separate:

- **round score:** earned during one round;
- **match score:** total toward winning the current game;
- **profile statistics:** aggregates saved only for registered users.

Update final match results exactly once using a match-completion ID and a
DynamoDB transaction or conditional writes. Do not trust a score submitted by
the browser.

A global leaderboard is deliberately later. Correct match results and personal
history should come first.

**Exit check:** guests can still play without prompts; a registered player can
sign in and see verified stats after a completed match; replayed completion
events cannot increment stats twice.

### Phase 5 — Production hardening

**Outcome:** the service is observable, recoverable, and safe enough for a small
public beta.

1. Add structured JSON logs containing request ID, room ID, command ID, version,
   and result. Never log tokens, authorization headers, deck order, email
   addresses, or full room snapshots.
2. Add CloudWatch alarms for:
   - Lambda errors and throttles;
   - API 5xx responses;
   - WebSocket connection failures;
   - SQS oldest-message age and dead-letter messages;
   - DynamoDB throttling;
   - unusual estimated spend.
3. Configure API throttling and strict request-size limits.
4. Validate every request at the boundary.
5. Restrict CORS to the deployed frontend origins.
6. Give each Lambda only the table, queue, secret, and API permissions it needs.
7. Add DynamoDB point-in-time recovery before meaningful registered-user data
   is stored.
8. Add a `dev` and `prod` deployment with separate tables and Cognito pools.
9. Add a custom domain only after the CloudFront URL is stable:
   - Route 53 hosted zone if DNS will be in AWS;
   - ACM certificate in `us-east-1` for CloudFront;
   - CloudFront alternate domain name;
   - DNS alias record to CloudFront.
10. Consider AWS WAF only when public traffic or abuse justifies its fixed and
    usage costs.

**Exit check:** alarms are tested, rollback is documented, dev data cannot be
mixed with production, and a failed deployment can be restored.

## Game-service design rules

These rules prevent most multiplayer bugs and cheating:

1. **The server is authoritative.** A client asks to hit; it does not say which
   card it drew or how many points it earned.
2. **One state transition per command.** The shared reducer remains the single
   source of game rules.
3. **Optimistic concurrency.** Every room has a monotonically increasing
   `version`; DynamoDB conditional writes prevent two simultaneous moves.
4. **Idempotency.** A repeated `commandId` returns the prior result rather than
   applying the move twice.
5. **Sanitized snapshots.** Do not expose deck order, credentials, internal
   connection IDs, or other hidden state.
6. **Reconnect from truth.** WebSocket messages are notifications, not the only
   record. On reconnect or a version gap, fetch the room over HTTP.
7. **Explicit expiry.** Rooms, sessions, tickets, and connections have expiry
   times checked by code as well as DynamoDB TTL.
8. **Bots use the same commands.** A bot cannot bypass turn validation or score
   rules.

## Suggested repository layout

```text
app/
  game/                    Shared pure rules and types
  online/                  API client, session, room and socket state
services/
  game-api/
    handlers/              HTTP and WebSocket Lambda handlers
    auth/                  Guest/Cognito principal validation
    bots/                  Strategy and SQS handler
    persistence/           DynamoDB repositories
packages/
  game-engine/             Eventually move shared rules here
  contracts/               Request/event schemas shared by client and Lambda
infra/
  bin/
  lib/
    frontend-stack.ts
    data-stack.ts
    api-stack.ts
    auth-stack.ts
    monitoring-stack.ts
```

Do not move all current files before the first deployment. Extract
`packages/game-engine` when the first Lambda needs to consume the rules.

## Testing plan

### Existing local mode

- Keep all current reducer and scoring tests.
- Keep lint and production build as release gates.

### Online service

- Unit-test authorization and every command transition.
- Test stale versions, duplicate command IDs, invalid turns, full rooms, expired
  sessions, and hidden-state sanitization.
- Test deterministic bot decisions using a seeded/random-function dependency.
- Test DynamoDB repository code against DynamoDB Local or an isolated AWS dev
  table.
- Add one browser test with two contexts:
  create room -> join -> play -> disconnect -> reconnect -> complete game.
- Add one account test:
  guest game -> sign in -> next completed match appears in profile stats.

## Cost controls

This design mostly uses request-based services and should be inexpensive at MVP
traffic, but no architecture can guarantee a zero bill.

- Use one main region and one `dev` environment initially.
- Use DynamoDB on-demand capacity.
- Set short CloudWatch log retention in development.
- Avoid detailed tracing until it is needed.
- Add lifecycle expiry for old S3 deployment artifacts if retained.
- Delete unused CloudFront distributions, buckets, queues, APIs, tables, and
  Cognito test resources after experiments.
- Do not add a NAT Gateway to this serverless design.
- Check Cost Explorer and the billing dashboard after every phase.
- Estimate production traffic with the AWS Pricing Calculator before launch.

Common surprise costs are verbose CloudWatch logs, WAF, Route 53 hosted zones,
custom-domain registration, excessive CloudFront invalidations, and resources
left running after experiments.

## Recommended implementation order

Work through these tickets in order:

1. `AWS-001` Account MFA, Identity Center, CLI profile, budget alerts.
2. `AWS-002` Next.js static export and local `out/` verification.
3. `AWS-003` Manual private S3 plus CloudFront deployment.
4. `AWS-004` Smoke-test and practise updating the AWS-hosted game.
5. `AWS-005` Reproduce the working frontend infrastructure with CDK.
6. `AWS-006` Shared API contracts and extracted game engine.
7. `AWS-007` DynamoDB room model and conditional state updates.
8. `AWS-008` Guest sessions and create/join/get-room HTTP endpoints.
9. `AWS-009` Server-authoritative command endpoint.
10. `AWS-010` WebSocket connect, broadcast, reconnect, and cleanup.
11. `AWS-011` Two-browser multiplayer UI and end-to-end test.
12. `AWS-012` SQS bot turns and Easy/Normal strategies.
13. `AWS-013` Cognito registration and managed login.
14. `AWS-014` Persistent registered-player statistics.
15. `AWS-015` Production alarms, backups, throttling, and custom domain.

## Decisions intentionally postponed

- public matchmaking;
- chat and moderation;
- spectator mode;
- global leaderboards;
- social identity providers;
- saved/resumable matches lasting more than the room TTL;
- AWS WAF;
- multi-region operation;
- containers or relational databases;
- actual generative AI.

These can be added later without changing the core principle that the server
owns game state.

## First guided session

The first hands-on session should complete only `AWS-001` through `AWS-004`:

1. secure and configure the AWS account;
2. convert the current app to a tested static export;
3. manually create the private S3 and CloudFront resources;
4. deploy the `out` directory;
5. play one complete game from the CloudFront URL;
6. inspect the S3, CloudFront, and billing views;
7. practise updating and rolling back the deployment.

CDK automation comes after the manual deployment is understood. Only after that
should we create DynamoDB or Lambda resources.

## References

- [AWS Amplify support for Next.js](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html)
- [Create an S3 general purpose bucket](https://docs.aws.amazon.com/AmazonS3/latest/userguide/create-bucket-overview.html)
- [Restrict an S3 origin with CloudFront OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [Set a CloudFront default root object](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DefaultRootObject.html)
- [Create a CloudFront invalidation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation_Requests.html)
- [AWS CDK TypeScript projects](https://docs.aws.amazon.com/cdk/v2/guide/work-with-cdk-typescript.html)
- [Bootstrap an AWS environment for CDK](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-env.html)
- [CDK S3 origin with Origin Access Control](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront_origins.S3BucketOrigin.html)
- [Deploy AWS CDK applications](https://docs.aws.amazon.com/cdk/v2/guide/deploy.html)
- [AWS tutorial: HTTP API with Lambda and DynamoDB](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-dynamo-db.html)
- [API Gateway WebSocket Lambda authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-lambda-auth.html)
- [Amazon Cognito user pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools.html)
- [Cognito identity-pool guest access](https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools.html)
