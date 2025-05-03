import { SQSEvent, SQSBatchResponse } from "aws-lambda";
import {
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  SNSClient,
  PublishCommand,
} from "@aws-sdk/client-sns";
import {
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const dynamo = new DynamoDBClient({});
const snsClient = new SNSClient({});
const s3 = new S3Client({});

const tableName = process.env.TABLE_NAME!;
const statusChangedTopicArn = process.env.NOTIFY_TOPIC_ARN!;
const allowedExtensions = ['.jpeg', '.png'];

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const s3Event = JSON.parse(record.body);
      for (const s3Record of s3Event.Records) {
        const bucket = s3Record.s3.bucket.name;
        const rawKey = s3Record.s3.object.key;
        const objectKey = decodeURIComponent(rawKey.replace(/\+/g, " "));
        const ext = objectKey.substring(objectKey.lastIndexOf('.')).toLowerCase();
        const isValidImage = allowedExtensions.includes(ext);

        const putCmd = new PutItemCommand({
          TableName: tableName,
          Item: {
            id: { S: objectKey },
            caption: { S: "" },
            status: { S: "PENDING" },
            reason: { S: "" },
          },
          ConditionExpression: "attribute_not_exists(id)",
        });

        await dynamo.send(putCmd);
        console.log(`✅ Inserted image record for ${objectKey}`);

        if (!isValidImage) {
          await s3.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: objectKey,
          }));
          console.log(`🗑️ Deleted invalid file from S3: ${objectKey}`);

          await snsClient.send(new PublishCommand({
            TopicArn: statusChangedTopicArn,
            Message: JSON.stringify({
              id: objectKey,
              update: {
                status: "REJECTED",
                reason: "Invalid file format",
              },
            }),
            MessageAttributes: {
              notification_type: {
                DataType: "String",
                StringValue: "status",
              },
            },
          }));
          console.log(`⚠️ Rejected file notified: ${objectKey}`);
        }
      }
    } catch (err: any) {
      console.error("❌ Failed to process image:", err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
