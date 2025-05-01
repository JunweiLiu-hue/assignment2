import { SQSHandler } from "aws-lambda";
import {
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const s3 = new S3Client();

export const handler: SQSHandler = async (event) => {
  console.log("DLQ Event:", JSON.stringify(event));

  for (const record of event.Records) {
    const body = JSON.parse(record.body);

    if (body.Records) {
      for (const messageRecord of body.Records) {
        const s3e = messageRecord.s3;
        const bucket = s3e.bucket.name;
        const key = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));

        if (!key.endsWith('.jpeg') && !key.endsWith('.png')) {
          try {
            await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
            console.log(`🗑️ Deleted invalid file from S3: ${key}`);
          } catch (error) {
            console.error(`❌ Failed to delete ${key}:`, error);
          }
        } else {
          console.log(`✅ Valid file type retained: ${key}`);
        }
      }
    } else {
      console.warn("⚠️ No 'Records' field in DLQ body.");
    }
  }
};
