import { SNSEvent } from "aws-lambda";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({});
const sender = process.env.SENDER_EMAIL!;

export const handler = async (event: SNSEvent) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);

    const recipient = message.email; // Assume email provided in message
    const status = message.update.status;
    const reason = message.update.reason;

    const subject = `Your photo review result: ${status}`;
    const body = `Hello,\n\nYour photo "${message.id}" was reviewed.\nStatus: ${status}\nReason: ${reason}`;

    const sendCmd = new SendEmailCommand({
      Destination: { ToAddresses: [recipient] },
      Message: {
        Subject: { Data: subject },
        Body: { Text: { Data: body } },
      },
      Source: sender,
    });

    try {
      await ses.send(sendCmd);
      console.log(`📨 Email sent to ${recipient}`);
    } catch (err) {
      console.error(`❌ Failed to send email to ${recipient}`, err);
    }
  }
};
