[![npm version](https://badge.fury.io/js/sendgrid-template-helper.svg)](https://badge.fury.io/js/sendgrid-template-helper)
[![Node.js CI](https://github.com/t-ho/sendgrid-template-helper/workflows/Node.js%20CI/badge.svg?branch=master)](https://github.com/t-ho/sendgrid-template-helper/actions)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![license](https://img.shields.io/npm/l/sendgrid-template-helper)](https://github.com/t-ho/sendgrid-template-helper/blob/master/LICENSE)

# sendgrid-template-helper

The Sendgrid wrapper helps to send an email with a dynamic template stored on disk. It tries to create a dynamic template on the Sendgrid server via [Sendgrid API v3](https://sendgrid.com/docs/API_Reference/api_v3.html), then caches the template ID locally for later uses.

## Installation

Install `sendgrid-template-helper` via NPM:

```bash
npm install --save sendgrid-template-helper
# or
yarn add sendgrid-template-helper
```

## Obtain a Sendgrid API Key

Create your Sendgrid API Key from [SendGrid](https://app.sendgrid.com/settings/api_keys)

## Setup Environment variables

In your development environment, export your Sendgrid API Key as follow:

```bash
export SENDGRID_API_KEY=YOUR_API_KEY
```

## Send email

To send an email with dynamic email template (template is on your disk):

```javascript
const path = require("path");
const Email = require("sendgrid-template-helper");

const settings = {
  apiKey: process.env.SENDGRID_API_KEY,
  prefix: "your_app_name_",
};

const email = new Email(settings);

email
  .send({
    to: "user@tdev.app",
    from: "admin@tdev.app",
    subject: `[Test] Sendgrid template helper`,
    templatePath: path.resolve(__dirname, "./dynamic-email-template.html"), // absolute path to your template
    dynamicTemplateData: {
      // your dynamic template data
      username: "user",
    },
  })
  .then(() => {})
  .catch(console.log);
```

For more use cases, please see [Sendgrid use cases](https://github.com/sendgrid/sendgrid-nodejs/blob/master/use-cases/README.md#email-use-cases).

### Email settings

| Property Name | Type     | Description                                           |
| ------------- | -------- | ----------------------------------------------------- |
| `apiKey`      | _string_ | SendGrid API Key                                      |
| `prefix`      | _string_ | The prefix used as namespace to create template name. |

## Testing

```bash
# Export your SendGrid API Key
export SENDGRID_API_KEY=YOUR_API_KEY

# Run all tests
npm test
```

## License

[MIT &copy; t-ho](https://github.com/t-ho/sendgrid-template-helper/blob/master/LICENSE)
