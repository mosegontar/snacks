const functions = require('firebase-functions');
const gPubSub = require('@google-cloud/pubsub')();
const gcs = require('@google-cloud/storage')();
const fs = require('fs-extra');
const ObjectID = require('bson-objectid');

const topics = require('./lib/pubsub/topics');
const makeReceiveEmail = require('./lib/http/receiveEmail');
const makeReceivedAttachments = require('./lib/pubsub/receivedAttachments');
const makeReplayJobs = require('./lib/pubsub/replayJobs');
const Mailgun = require('./lib/clients/mailgun');

// wrapper for easier testing
function makePubSub(topic) {
  return {
    publish(message, options) {
      return gPubSub.topic(topic).publish(message, options);
    },
  };
}

// wrapper for easier testing
function makeCloudStorage(bucket) {
  return {
    upload(path, options) {
      return gcs.bucket(bucket).upload(path, options);
    },
    download(path) {
      return gcs.bucket(bucket).file(path).download();
    },
  };
}

// wrapper for easier testing
const localFS = {
  writeJSON(path, data) {
    return fs.writeJSON(path, data);
  },
  writeFile(path, data) {
    return fs.writeFile(path, data);
  }
}

const receivedAttachmentsPubSub = makePubSub(topics.receivedAttachments);
const incomingMessagesCloudStorage = makeCloudStorage(functions.config().incomingmessages.bucket);

const contentCloudStorage = makeCloudStorage(functions.config().content.bucket);

const receiveEmail = makeReceiveEmail(receivedAttachmentsPubSub, incomingMessagesCloudStorage, localFS, ObjectID);
exports.receiveEmail = functions.https.onRequest(receiveEmail);

const maxFileSizeBytes = 10 * 1000 * 1000; // 10 mb
const mailgun = new Mailgun(functions.config().mailgun.apikey);
const receivedAttachments = makeReceivedAttachments(maxFileSizeBytes, mailgun, localFS, contentCloudStorage);
exports.receivedAttachmentsPubSub = functions.pubsub.topic(topics.receivedAttachments).onPublish(receivedAttachments);

const replayJobs = makeReplayJobs(incomingMessagesCloudStorage, receivedAttachmentsPubSub);
exports.replayJobsPubSub = functions.pubsub.topic(topics.replayJobs ).onPublish(replayJobs);
