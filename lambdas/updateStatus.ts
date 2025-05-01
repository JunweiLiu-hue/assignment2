import { SNSEvent } from "aws-lambda";
import {
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: SNSEvent) => {
  for (const record of event.Records) {
    const body = JSON.parse(record.Sns.Message);
    const metadataType = record.Sns.MessageAttributes?.metadata_type?.Value;

    if (metadataType === "status") {
      try {
        const updateCommand = new UpdateItemCommand({
          TableName: tableName,
          Key: { id: { S: body.id } },
          UpdateExpression: "SET #s = :s",
          ExpressionAttributeNames: {
            "#s": "status",
          },
          ExpressionAttributeValues: {
            ":s": { S: body.value },
          },
        });

        await dynamo.send(updateCommand);
        console.log(`✅ Status updated for ${body.id} to ${body.value}`);
      } catch (err) {
        console.error("❌ Failed to update status", err);
      }
    } else {
      console.warn("⚠️ Ignored message without 'status' metadata_type");
    }
  }
};
