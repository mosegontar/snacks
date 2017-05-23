## Initial Setup
1. `yarn install`

## Tests
Written with [mocha](https://mochajs.org/) and [expect](https://github.com/mjackson/expect).

* `yarn test`
* `yarn run autotest` to automatically re-run on file changes

## GCP Configuration

### Topics
The following must be created:
* `received-attachments`: new attachment metadata are enqueued here

### Function Configuration
The following must be set with `firebase functions:config:set`:

* `mailgun.apikey`

## Mailgun Configuration
Setup a routing rule to store messages for the desired address.
The `store` call should be configured with the URL to the `receiveEmail` function.

