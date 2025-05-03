import { SQSHandler } from "aws-lambda";
import {
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const s3 = new S3Client();

export const handler: SQSHandler = async (event) => {
  console.log("🪵 DLQ Event received:", JSON.stringify(event));

  for (const record of event.Records) {
    try {
      const body = typeof record.body === "string" ? JSON.parse(record.body) : record.body;

      let s3Records;
      try {
        if (body?.Records) {
          s3Records = body.Records;
        } else if (typeof body?.Message === "string") {
          const inner1 = JSON.parse(body.Message);
          if (inner1?.Records) {
            s3Records = inner1.Records;
          } else if (typeof inner1?.Message === "string") {
            const inner2 = JSON.parse(inner1.Message);
            if (inner2?.Records) {
              s3Records = inner2.Records;
            }
          }
        }
      } catch (parseErr) {
        console.warn("⚠️ Failed to parse nested DLQ message:", parseErr);
      }

      if (!s3Records || !Array.isArray(s3Records)) {
        console.warn("⚠️ No valid 'Records' array found in message body.");
        continue;
      }

      for (const messageRecord of s3Records) {
        const s3e = messageRecord?.s3;
        if (!s3e) {
          console.warn("⚠️ Missing 's3' field in record:", messageRecord);
          continue;
        }

        const bucket = s3e.bucket.name;
        const key = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));

        if (!key.endsWith(".jpeg") && !key.endsWith(".png")) {
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
    } catch (err) {
      console.error("❌ Failed to process DLQ message:", err);
    }
  }
};
