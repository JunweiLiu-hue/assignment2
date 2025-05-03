## Distributed Systems - Event-Driven Architecture.

__Name:__ Junwei Liu

__Demo__: https://youtu.be/coJNRj3gSaI

This repository contains the implementation of a skeleton design for an application that manages a photo gallery, illustrated below. The app uses an event-driven architecture and is deployed on the AWS platform using the CDK framework for infrastructure provisioning.

![](./images/arch.png)

### Code Status.

[Advice: In this section, state the status of your submission for each feature listed below. The status options are: (1) Completed & Tested; (2) Attempted (i.e. partially works); (3) Not Attempted. Option (1) implies the feature performs the required action (e.g. updates the table) __only when appropriate__, as dictated by the relevant filtering policy described in the specification.]

__Feature:__
+ Photographer:
  + Log new Images - Completed and Tested.
  + Metadata updating - Completed and Tested.
  + Invalid image removal   - Completed and Tested.
  + Status Update Mailer - Completed and Tested.
+ Moderator
  + Status updating - Completed and Tested.
+ Filtering - Completed and Tested.
+ Messaging - Completed and Tested.


### Notes (Optional)

processImage.ts uses reportBatchItemFailures = true to ensure failed items are retried and moved to DLQ when necessary.
All Lambda functions are triggered via event sources (SQS or SNS), and function-specific filtering ensures only relevant messages are processed.
