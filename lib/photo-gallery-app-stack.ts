import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as iam from 'aws-cdk-lib/aws-iam';

export class PhotoGalleryAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const imagesBucket = new s3.Bucket(this, 'images');

    const deadLetterQueue = new sqs.Queue(this, 'image-dlq', {
      queueName: 'image-dlq',
      retentionPeriod: cdk.Duration.days(3),
    });

    const queue = new sqs.Queue(this, 'img-created-queue', {
      receiveMessageWaitTime: cdk.Duration.seconds(5),
      deadLetterQueue: {
        maxReceiveCount: 2,
        queue: deadLetterQueue,
      },
    });

    imagesBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SqsDestination(queue)
    );

    const imagesTable = new dynamodb.Table(this, 'ImagesTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const processImageFn = new lambdanode.NodejsFunction(this, 'ProcessImageFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/processImage.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
      environment: {
        TABLE_NAME: imagesTable.tableName, // ✅ 修复点
      },
    });
    processImageFn.addEventSource(new events.SqsEventSource(queue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    }));
    imagesBucket.grantRead(processImageFn);
    imagesTable.grantWriteData(processImageFn); // ✅ 记得授权写表

    const removeImageFn = new lambdanode.NodejsFunction(this, 'RemoveImageFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/removeImage.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
      bundling: {
        forceDockerBundling: false,
      },
    });
    removeImageFn.addEventSource(new events.SqsEventSource(deadLetterQueue));
    imagesBucket.grantDelete(removeImageFn);

    const metadataTopic = new sns.Topic(this, 'MetadataTopic');

    const addMetadataFn = new lambdanode.NodejsFunction(this, 'AddMetadataFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/addMetadata.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      bundling: {
        forceDockerBundling: false,
      },
      environment: {
        TABLE_NAME: imagesTable.tableName,
      },
    });
    metadataTopic.addSubscription(new subscriptions.LambdaSubscription(addMetadataFn));
    imagesTable.grantWriteData(addMetadataFn);

    const statusChangedTopic = new sns.Topic(this, 'StatusChangedTopic');

    const updateStatusFn = new lambdanode.NodejsFunction(this, 'UpdateStatusFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/updateStatus.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      bundling: {
        forceDockerBundling: false,
      },
      environment: {
        TABLE_NAME: imagesTable.tableName,
        NOTIFY_TOPIC_ARN: statusChangedTopic.topicArn,
      },
    });
    metadataTopic.addSubscription(new subscriptions.LambdaSubscription(updateStatusFn));
    imagesTable.grantWriteData(updateStatusFn);
    statusChangedTopic.grantPublish(updateStatusFn);

    const confirmationMailerFn = new lambdanode.NodejsFunction(this, 'ConfirmationMailerFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/confirmationMailer.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      bundling: {
        forceDockerBundling: false,
      },
      environment: {
        SENDER_EMAIL: "20109222@mail.wit.ie",
      },
    });
    statusChangedTopic.addSubscription(new subscriptions.LambdaSubscription(confirmationMailerFn));

    confirmationMailerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      })
    );

    new cdk.CfnOutput(this, 'bucketName', {
      value: imagesBucket.bucketName,
    });
  }
}
