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

      if (!body.id || !body.update?.status || !body.update?.reason) {
        console.warn("⚠️ Missing required fields in message body", body);
        continue;
      }

      const updateCommand = new UpdateItemCommand({
        TableName: tableName,
        Key: { id: { S: body.id } },
        UpdateExpression: "SET #s = :s, #r = :r",
        ExpressionAttributeNames: {
          "#s": "status",
          "#r": "reason",
        },
        ExpressionAttributeValues: {
          ":s": { S: body.update.status },
          ":r": { S: body.update.reason },
        },
      });

      await dynamo.send(updateCommand);
      console.log(`✅ Updated status for ${body.id} to ${body.update.status}`);
    } catch (error) {
      console.error("❌ Error processing message:", error);
    }
  }
};
