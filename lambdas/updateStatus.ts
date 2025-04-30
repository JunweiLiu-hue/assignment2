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

    try {
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
      console.log(`✅ Status updated for ${body.id}`);
    } catch (err) {
      console.error("❌ Failed to update status", err);
    }
  }
};
