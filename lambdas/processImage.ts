import { SQSHandler } from "aws-lambda";
import {
  GetObjectCommand,
  GetObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";

const s3 = new S3Client();

export const handler: SQSHandler = async (event) => {
  console.log("Received event:", JSON.stringify(event));

  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);

    if (recordBody.Records) {
      for (const messageRecord of recordBody.Records) {
        const s3e = messageRecord.s3;
        const srcBucket = s3e.bucket.name;
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));

        try {
          const params: GetObjectCommandInput = {
            Bucket: srcBucket,
            Key: srcKey,
          };

          const origImage = await s3.send(new GetObjectCommand(params));
          console.log(`✅ Image downloaded successfully: ${srcKey}`);
        } catch (error) {
          console.error(`❌ Failed to get image ${srcKey} from bucket ${srcBucket}`, error);
        }
      }
    } else {
      console.warn("⚠️ No 'Records' field in SQS message body.");
    }
  }
};
