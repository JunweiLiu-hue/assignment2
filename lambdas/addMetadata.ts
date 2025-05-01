import { SNSEvent } from "aws-lambda";
import {
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: SNSEvent) => {
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.Sns.Message);
      const metadataTypeRaw = record.Sns.MessageAttributes?.metadata_type?.Value;

      if (!body.id || !body.value || !metadataTypeRaw) {
        console.warn("⚠️ Missing id, value or metadata_type in SNS message.");
        continue;
      }

      const metadataType = metadataTypeRaw.toLowerCase();
      const allowedTypes = ["caption", "date", "name"];
      if (!allowedTypes.includes(metadataType)) {
        console.warn(`⚠️ Unsupported metadata_type: ${metadataTypeRaw}`);
        continue;
      }

      const updateCommand = new UpdateItemCommand({
        TableName: tableName,
        Key: { id: { S: body.id } },
        UpdateExpression: "SET #attr = :val",
        ExpressionAttributeNames: {
          "#attr": metadataType.charAt(0).toUpperCase() + metadataType.slice(1), // Caption, Date, Name
        },
        ExpressionAttributeValues: {
          ":val": { S: body.value },
        },
      });

      await dynamo.send(updateCommand);
      console.log(`✅ Updated ${metadataType} for ${body.id}: ${body.value}`);
    } catch (error) {
      console.error("❌ Failed to process metadata message:", error);
    }
  }
};
