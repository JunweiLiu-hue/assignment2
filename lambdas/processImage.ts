import { S3Event } from "aws-lambda";
import {
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const s3ObjectKey = record.s3.object.key;

    try {
      const putCmd = new PutItemCommand({
        TableName: tableName,
        Item: {
          id: { S: decodeURIComponent(s3ObjectKey.replace(/\+/g, ' ')) },
          caption: { S: "" },        
          status: { S: "PENDING" },   
          reason: { S: "" }          
        },
        ConditionExpression: "attribute_not_exists(id)" 
      });

      await dynamo.send(putCmd);
      console.log(`✅ Inserted image record for ${s3ObjectKey}`);
    } catch (err: any) {
      if (err.name === "ConditionalCheckFailedException") {
        console.log(`⚠️ Record for ${s3ObjectKey} already exists`);
      } else {
        console.error("❌ Failed to insert image record:", err);
      }
    }
  }
};
