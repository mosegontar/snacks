const _ = require('lodash');
const expect = require('expect')
const { makeReceivedAttachments, makeReprocessImages } = require('../../lib/pubsub/processUploads');
const fakes = require('../fakes');
const requestBody = require('../fixtures/requests/receiveEmail/body.json');
const attachments = JSON.parse(requestBody.attachments);

function makeEvent(attachments) {
  return {
    data: {
      attributes: {
        submissionId: 'objectId',
      },
      json: {
        attachments,
      },
    },
  };
}

describe('receivedAttachments', function() {
  beforeEach(function() {
    this.mailgun = fakes.mailgun();
    this.localFS = fakes.localFS();
    this.cloudStorage = fakes.cloudStorage();
    this.datastore = fakes.datastore();
    this.imageManipulation = fakes.imageManipulation();
    this.receivedAttachments = makeReceivedAttachments(this.mailgun, this.localFS, this.cloudStorage, this.datastore, this.imageManipulation);
  });

  it('runs successfully', function() {
    this.mailgun.get.resolves('image data')
    this.datastore.key.returnsArg(0);
    this.imageManipulation.getSize.resolves({
      height: 10,
      width: 100,
    });

    const event = makeEvent(attachments);
    return this.receivedAttachments(event)
      .then(() => {
        expect(this.localFS.writeFile).toBeCalledWith('/tmp/objectId-0.jpeg', 'image data');
        expect(this.imageManipulation.fixup).toBeCalledWith('/tmp/objectId-0.jpeg')
        expect(this.cloudStorage.upload).toBeCalledWith(
          '/tmp/objectId-0.jpeg',
          {
            destination: '/images/objectId-0.jpeg',
            resumable: false,
            public: true,
            gzip: true,
          }
        );
        expect(this.imageManipulation.getSize).toBeCalledWith('/tmp/objectId-0.jpeg')
        expect(this.datastore.save).toBeCalledWith({
          key: ['posts', 'objectId-0'],
          method: 'upsert',
          data: [
            {
              name: 'post_id',
              value: 'objectId-0',
            },
            {
              name: 'image_path',
              value: '/images/objectId-0.jpeg',
              excludeFromIndexes: true,
            },
            {
              name: 'image_height',
              value: 10,
              excludeFromIndexes: true,
            },
            {
              name: 'image_width',
              value: 100,
              excludeFromIndexes: true,
            },
            {
              name: 'submission_id',
              value: 'objectId',
            },
          ],
        });
      });
  });

  it('exits when missing attachments data', function() {
    const event = makeEvent();
    return this.receivedAttachments(event);
  });

  it('skips attachments that are too large', function() {
    const data = _.map(attachments, (attachment) => _.extend({}, attachment, { size: 20000000 }));
    const event = makeEvent(data);
    return this.receivedAttachments(event);
  });

  it('skips attachments with non-image content types', function() {
    const data = _.map(attachments, (attachment) => _.extend({}, attachment, { 'content-type': 'application/pdf' }));
    const event = makeEvent(data);
    return this.receivedAttachments(event);
  });
});

describe('reprocessImages', function() {
  beforeEach(function() {
    this.localFS = fakes.localFS();
    this.cloudStorage = fakes.cloudStorage();
    this.datastore = fakes.datastore();
    this.imageManipulation = fakes.imageManipulation();
    this.reprocessImages = makeReprocessImages(this.localFS, this.cloudStorage, this.datastore, this.imageManipulation);
  });

  it('runs successfully', function() {
    this.cloudStorage.download.resolves('image data');
    this.datastore.key.returnsArg(0);
    this.imageManipulation.getSize.resolves({
      height: 10,
      width: 100,
    });

    const event = {
      data: {
        json: {
          pathsToReprocess: ["/images/objectId-0.jpeg"],
        }
      }
    };
    return this.reprocessImages(event)
      .then(() => {
        expect(this.localFS.writeFile).toBeCalledWith('/tmp/objectId-0.jpeg', 'image data');
        expect(this.imageManipulation.fixup).toBeCalledWith('/tmp/objectId-0.jpeg')
        expect(this.cloudStorage.upload).toBeCalledWith(
          '/tmp/objectId-0.jpeg',
          {
            destination: '/images/objectId-0.jpeg',
            resumable: false,
            public: true,
            gzip: true,
          }
        );
        expect(this.imageManipulation.getSize).toBeCalledWith('/tmp/objectId-0.jpeg')
        expect(this.datastore.save).toBeCalledWith({
          key: ['posts', 'objectId-0'],
          method: 'upsert',
          data: [
            {
              name: 'post_id',
              value: 'objectId-0',
            },
            {
              name: 'image_path',
              value: '/images/objectId-0.jpeg',
              excludeFromIndexes: true,
            },
            {
              name: 'image_height',
              value: 10,
              excludeFromIndexes: true,
            },
            {
              name: 'image_width',
              value: 100,
              excludeFromIndexes: true,
            },
            {
              name: 'submission_id',
              value: 'objectId',
            },
          ],
        });
      });
  });
});

