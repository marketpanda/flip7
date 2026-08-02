import * as path from "path"
import * as cdk from "aws-cdk-lib"
import { Construct } from "constructs"
import * as cloudfront from "aws-cdk-lib/aws-cloudfront"
import * as origins from "aws-cdk-lib/aws-cloudfront-origins"
import * as s3 from "aws-cdk-lib/aws-s3"
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment"
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const websiteBucket = new s3.Bucket(this,
      "WebsiteBucket", {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
        versioned: true,
        removalPolicy: cdk.RemovalPolicy.RETAIN
      }
    )

    const distribution = new cloudfront.Distribution(
      this,
      "WebsiteDistribution",
      {
        defaultRootObject: "index.html",
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy
            .REDIRECT_TO_HTTPS
        }
      }
    )

    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "..", "..", "out")),
      ],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ["/*"],
      prune: true
    })

    new cdk.CfnOutput(this, "WebsiteUrl", {
      value: `https://${distribution.distributionDomainName}`,
    })

    new cdk.CfnOutput(this,
      "WebsiteBucketName", {
        value: websiteBucket.bucketName
    })

    new cdk.CfnOutput(this,
      "DistributionId", {
        value: distribution.distributionId
    })
  }
}
