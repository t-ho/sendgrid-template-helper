const path = require('path');
const Email = require('./lib');

const email = new Email({
  apiKey: process.env.SENDGRID_API_KEY,
  prefix: 'your_app_name_'
});

email
  .send({
    to: 'user@tdev.app',
    from: 'admin@tdev.app',
    subject: `[Test] Sendgrid template helper`,
    templatePath: path.resolve(__dirname, './dynamic-email-template.html'),
    dynamicTemplateData: {
      username: 'user'
    }
  })
  .then(() => {})
  .catch(console.log);
