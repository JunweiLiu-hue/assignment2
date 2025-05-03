import { SNSEvent } from "aws-lambda";
import {
  SESClient,
  SendEmailCommand,
} from "@aws-sdk/client-ses";

const ses = new SESClient({ region: "eu-west-1" }); 

const senderEmail = process.env.SENDER_EMAIL!;
const receiverEmail = process.env.RECEIVER_EMAIL!;

export const handler = async (event: SNSEvent) => {
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.Sns.Message);
      const { id, update } = message;

      const emailParams = {
        Destination: {
          ToAddresses: [receiverEmail],
        },
        Message: {
          Subject: {
            Data: `Image status update for ${id}`,
          },
          Body: {
            Text: {
              Data: `The image ${id} has been marked as ${update.status}.\nReason: ${update.reason || "None"}`,
            },
          },
        },
        Source: senderEmail,
      };

      await ses.send(new SendEmailCommand(emailParams));
      console.log(`✅ Email sent for image: ${id}`);
    } catch (err) {
      console.error("❌ Failed to send email:", err);
    }
  }
};
