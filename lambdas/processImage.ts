import { SQSEvent } from "aws-lambda";
import {
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    try {

      const s3Event = JSON.parse(record.body);

      for (const s3Record of s3Event.Records) {
        const s3ObjectKey = decodeURIComponent(
          s3Record.s3.object.key.replace(/\+/g, " ")
        );

        const putCmd = new PutItemCommand({
          TableName: tableName,
          Item: {
            id: { S: s3ObjectKey },
            caption: { S: "" },
            status: { S: "PENDING" },
            reason: { S: "" },
          },
          ConditionExpression: "attribute_not_exists(id)",
        });

        await dynamo.send(putCmd);
        console.log(`✅ Inserted image record for ${s3ObjectKey}`);
      }
    } catch (err: any) {
      if (err.name === "ConditionalCheckFailedException") {
        console.log(`⚠️ Record already exists, skipping`);
      } else {
        console.error("❌ Failed to insert image record:", err);
      }
    }
  }
};
