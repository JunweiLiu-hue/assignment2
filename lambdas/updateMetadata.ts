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

      if (!body.id || !body.update) {
        console.warn("⚠️ Missing 'id' or 'update' fields in message body", body);
        continue;
      }

      const updateFields = body.update;
      const expressionParts: string[] = [];
      const expressionAttrNames: Record<string, string> = {};
      const expressionAttrValues: Record<string, any> = {};

      for (const key of Object.keys(updateFields)) {
        expressionParts.push(`#${key} = :${key}`);
        expressionAttrNames[`#${key}`] = key;
        expressionAttrValues[`:${key}`] = { S: updateFields[key] };
      }

      const command = new UpdateItemCommand({
        TableName: tableName,
        Key: { id: { S: body.id } },
        UpdateExpression: `SET ${expressionParts.join(", ")}`,
        ExpressionAttributeNames: expressionAttrNames,
        ExpressionAttributeValues: expressionAttrValues,
      });

      await dynamo.send(command);
      console.log(`✅ Updated fields for ${body.id}: ${Object.keys(updateFields).join(", ")}`);
    } catch (err) {
      console.error("❌ Error updating metadata:", err);
    }
  }
};
