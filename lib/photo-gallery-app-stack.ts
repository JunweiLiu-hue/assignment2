import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-lambda-event-sources';

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

    const processImageFn = new lambdanode.NodejsFunction(this, 'ProcessImageFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/processImage.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
    });

    const newImageEventSource = new events.SqsEventSource(queue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    });
    processImageFn.addEventSource(newImageEventSource);

    imagesBucket.grantRead(processImageFn);

    new cdk.CfnOutput(this, 'bucketName', {
      value: imagesBucket.bucketName,
    });

    const removeImageFn = new lambdanode.NodejsFunction(this, 'RemoveImageFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/removeImage.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
      bundling: {
        forceDockerBundling: false,
      },
    });
    
    const dlqEventSource = new events.SqsEventSource(deadLetterQueue);
    removeImageFn.addEventSource(dlqEventSource);
    
    imagesBucket.grantDelete(removeImageFn);

  }
}
