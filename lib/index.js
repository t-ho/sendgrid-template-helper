const fs = require('fs');
const fspath = require('path');
const crypto = require('crypto');
const { Client } = require('@sendgrid/client');
const { MailService } = require('@sendgrid/mail');
const _ = require('lodash');

class Email {
  static templateIds = {};

  constructor(settings) {
    settings = settings || {};
    if (!settings.apiKey) {
      throw new Error('Sendgird API Key is required');
    }
    this.apiKey = settings.apiKey;
    this.prefix = settings.prefix ? settings.prefix : 'sendgrid_helper_';
    this.postfix = `_${this.createHash(this.prefix + this.apiKey)}`;
    this.sgClient = new Client();
    this.sgClient.setApiKey(this.apiKey);
    this.sgClient.setDefaultRequest('baseUrl', 'https://api.sendgrid.com/v3');
    this.sgMail = new MailService();
    this.sgMail.setApiKey(this.apiKey);
  }

  /**
   * Send an email.
   * @param {object|array} messages - The Sendgrid message object or the array of message objects
   *
   * @param {string} [messages.subject] The subject portion of the email
   * @param {object} [messages.dynamicTemplateData] Object containing any dynamic parameters to be passed to the handlebars template specified in template
   * @param {string} [messages.templatePath] The absolute path of the email template file.
   * @param {string} [messages.from] The from portion of the email
   * @param {string} [messages.to] The to portion of the email
   * @return {Promise} A promise representing the status of the email being sent, resolve is called with the returned object from the nodemailer transporter
   */
  send(messages) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        Promise.resolve()
          .then(() => {
            if (_.isArray(messages)) {
              return Promise.all(messages.map(msg => this.mangleMessage(msg)));
            }
            return this.mangleMessage(messages);
          })
          .then(msgs => this.sgMail.send(msgs))
          .then(resolve, reject);
      });
    });
  }

  /**
   * @function mangleMessage
   * Mangle the message object
   *
   * @param {object} msg The message object
   *
   * @returns {Promise}
   */
  mangleMessage(msg) {
    return Promise.resolve().then(() => {
      msg = _.mapKeys(msg, (v, k) => _.camelCase(k));
      if (msg.templatePath) {
        if (msg.dynamicTemplateData) {
          // FIXME: sendgrid issue https://github.com/sendgrid/sendgrid-nodejs/issues/843
          msg.dynamicTemplateData.subject =
            msg.dynamicTemplateData.subject || msg.subject;
        }

        return this.getTemplateId(msg.templatePath).then(templateId => {
          msg.templateId = templateId;
          return msg;
        });
      }
      return msg;
    });
  }

  /**
   * @function sgRequest
   * Wrapper of Sendgrid request
   *
   * @param {string} method
   * @param {string} url
   * @param {object} body
   *
   * @returns {Promise}
   */
  sgRequest(method, url, body) {
    const request = { method, url, body };
    return this.sgClient
      .request(request)
      .then(([response, body]) => {
        return body;
      })
      .catch(err => {
        if (err.code === 401 || err.code === 403) {
          err = new Error('Invalid SendGrid API Key');
        }
        return Promise.reject(err);
      });
  }

  /**
   * @function getTemplates
   * Retrieve all the dynamic templates from Sendgrid
   *
   * @returns {Promise} Resolve with an array of dynamic templates
   */
  getTemplates() {
    return this.sgRequest('GET', '/templates?generations=dynamic').then(
      body => body.templates
    );
  }

  /**
   * @function createTemplate
   * Create a dynamic template
   *
   * @param {string} templateName The template name
   *
   * @returns {Promise} Resolve with a newly created template object
   */
  createTemplate(templateName) {
    return this.sgRequest('POST', '/templates', {
      name: templateName,
      generation: 'dynamic'
    });
  }

  /**
   * @function createTemplateVersion
   * Create a Sendgrid template version
   *
   * @param {string} templateId The template ID
   * @param {string} versionName The template version name
   * @param {string} htmlContent The HTML template content
   *
   * @returns {Promise} Resolve with a created template version object
   */
  createTemplateVersion(templateId, versionName, htmlContent) {
    return this.sgRequest('POST', `/templates/${templateId}/versions`, {
      template_id: templateId,
      name: versionName,
      html_content: htmlContent,
      active: 1,
      subject: '{{subject}}'
    });
  }

  /**
   * @function updateTemplateVersion
   * Update template version
   *
   * @param {string} versionId The template version ID
   * @param {string} templateId The template ID
   * @param {string} versionName The new template version name
   * @param {string} htmlContent The new HTML template content
   *
   * @returns {Promise} Resolve with the updated template version object
   */
  updateTemplateVersion(versionId, templateId, versionName, htmlContent) {
    return this.sgRequest(
      'PATCH',
      `/templates/${templateId}/versions/${versionId}`,
      {
        name: versionName,
        html_content: htmlContent
      }
    );
  }

  /**
   * @function getTemplateId
   * Get the template ID from Sendgrid server and cache it
   *
   * @param {string} templatePath The template's absolute path
   *
   * @returns {Promise} Resolve with the template ID
   */
  getTemplateId(templatePath) {
    const templateFilename = fspath.parse(templatePath).base;
    const templateName = `${this.prefix}${templateFilename}${this.postfix}`;
    // Check local cache
    if (Email.templateIds[templateName]) {
      return Promise.resolve(Email.templateIds[templateName]);
    }
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const versionName = this.createHash(templateContent);

    return this.getTemplates().then(templates => {
      const existingTemplate = _.find(templates, t => t.name === templateName);
      if (!existingTemplate) {
        return this.createTemplate(templateName).then(template => {
          return this.createTemplateVersion(
            template.id,
            versionName,
            templateContent
          ).then(version => {
            Email.templateIds[templateName] = version.template_id;
            return version.template_id;
          });
        });
      }

      const existingVersion = existingTemplate.versions[0];
      if (existingVersion) {
        // template content is the same
        if (existingVersion.name === versionName) {
          Email.templateIds[templateName] = existingTemplate.id;
          return existingTemplate.id;
        } else {
          return this.updateTemplateVersion(
            existingVersion.id,
            existingTemplate.id,
            versionName,
            templateContent
          ).then(version => {
            Email.templateIds[templateName] = version.template_id;
            return version.template_id;
          });
        }
      }
      return this.createTemplateVersion(
        existingTemplate.id,
        versionName,
        templateContent
      ).then(version => {
        Email.templateIds[templateName] = version.template_id;
        return version.template_id;
      });
    });
  }

  /**
   * @function createHash
   * Create MD5 hash
   *
   * @param {string} message
   *
   * @returns {string} Hex digest
   */
  createHash(message) {
    return crypto
      .createHash('md5')
      .update(message)
      .digest('hex');
  }
}

module.exports = Email;
