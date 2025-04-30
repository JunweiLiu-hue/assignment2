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

    if (!metadataType || !["Caption", "Date", "Name"].includes(metadataType)) {
      console.warn("Invalid or missing metadata_type");
      continue;
    }

    try {
      const updateParams = new UpdateItemCommand({
        TableName: tableName,
        Key: { id: { S: body.id } },
        UpdateExpression: `SET #attr = :val`,
        ExpressionAttributeNames: {
          "#attr": metadataType,
        },
        ExpressionAttributeValues: {
          ":val": { S: body.value },
        },
      });

      await dynamo.send(updateParams);
      console.log(`✅ Updated ${metadataType} for ${body.id}`);
    } catch (error) {
      console.error("❌ Failed to update metadata", error);
    }
  }
};
