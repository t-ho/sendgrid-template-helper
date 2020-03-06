const path = require('path');
const fs = require('fs');
const chai = require('chai');
const crypto = require('crypto');
const sinonChai = require('sinon-chai');
const sinon = require('sinon');
const { Client } = require('@sendgrid/client');
const { MailService } = require('@sendgrid/mail');

const Email = require('../lib');
chai.use(sinonChai);
const expect = chai.expect;

const createHash = function(message) {
  return crypto
    .createHash('md5')
    .update(message)
    .digest('hex');
};

before(function(done) {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('Please specify SENDGRID_API_KEY env variable.');
  }
  done();
});

describe('Settings', function() {
  it('API key is required - API key is undefined', function(done) {
    expect(function() {
      const email = new Email();
    }).to.throw('SendGird API Key is required');
    done();
  });

  it('API key is required - API key is an empty string', function(done) {
    expect(function() {
      const email = new Email({ apiKey: '' });
    }).to.throw('SendGird API Key is required');
    done();
  });

  it('401 error should throw invalid API key error', function(done) {
    const email = new Email({
      apiKey: 'invalid-api-key'
    });
    email
      .send({ to: 'user@tdev.app' })
      .then(done)
      .catch(err => {
        expect(err.message).to.be.equal('Invalid SendGrid API Key');
        done();
      });
  });

  it('403 error should throw invalid API key error', function(done) {
    const email = new Email({
      apiKey: 'xehMF57xTRzwXp1tzZWXfs'
    });
    email
      .send({
        to: 'user@tdev.app',
        templatePath: path.resolve(__dirname, './template_01.html')
      })
      .then(done)
      .catch(err => {
        expect(err.message).to.be.equal('Invalid SendGrid API Key');
        done();
      });
  });

  it('Create instance of Email', function(done) {
    const prefix = 'sendgrid_template_helper_';
    const apiKey = 'api-key';
    const email = new Email({ apiKey });
    expect(email.sgClient).to.be.instanceOf(Client);
    expect(email.sgMail).to.be.instanceOf(MailService);
    expect(email.apiKey).to.be.equal(apiKey);
    expect(email.prefix).to.be.equal(prefix);
    expect(email.postfix).to.be.equal(`_${createHash(prefix + apiKey)}`);
    done();
  });
});

describe('Functions', function() {
  let email;

  before(function(done) {
    email = new Email({
      apiKey: process.env.SENDGRID_API_KEY
    });
    done();
  });

  beforeEach(function(done) {
    Email.templateIds = {};
    done();
  });

  it('sgRequest()', function(done) {
    let spy = sinon.spy(email.sgClient, 'request');
    email
      .sgRequest('POST', '/templates/testid', {
        name: 'template-name'
      })
      .then(() => {})
      .catch(err => {})
      .then(() => {
        expect(
          spy.calledWith({
            method: 'POST',
            url: '/templates/testid',
            body: {
              name: 'template-name'
            }
          })
        ).to.be.ok;
        done();
      });
  });

  it('getTemplates()', function(done) {
    let spy = sinon.spy(email, 'sgRequest');
    email.getTemplates().then(templates => {
      expect(spy.calledWith('GET', '/templates?generations=dynamic')).to.be.ok;
      expect(templates).to.be.an('array');
      templates.forEach(template => {
        expect(template).to.have.property('id');
        expect(template).to.have.property('name');
        expect(template).to.have.property('generation');
        expect(template).to.have.property('updated_at');
        expect(template).to.have.property('versions');
      });
      spy.restore();
      done();
    });
  });

  it('createTemplate()', function(done) {
    let spy = sinon.spy(email, 'sgRequest');
    const templateName = 'test-template-name';
    email.createTemplate(templateName).then(template => {
      expect(
        spy.calledWith('POST', '/templates', {
          name: templateName,
          generation: 'dynamic'
        })
      ).to.be.ok;
      expect(template).to.have.property('id');
      expect(template).to.have.property('name');
      expect(template).to.have.property('generation');
      expect(template).to.have.property('updated_at');
      expect(template).to.have.property('versions');
      email.sgRequest('DELETE', `/templates/${template.id}`).then(() => {
        spy.restore();
        done();
      });
    });
  });

  it('createVersion()', function(done) {
    let spy = sinon.spy(email, 'sgRequest');
    const templateName = 'test-template-name';
    email.createTemplate(templateName).then(template => {
      const versionName = 'version-name';
      const htmlContent = '<div>{{ title }}</div>';
      email
        .createVersion(template.id, versionName, htmlContent)
        .then(version => {
          expect(
            spy.calledWith('POST', `/templates/${template.id}/versions`, {
              template_id: template.id,
              name: versionName,
              html_content: htmlContent,
              active: 1,
              subject: '{{subject}}'
            })
          ).to.be.ok;
          expect(version).to.have.property('id');
          expect(version).to.have.property('template_id');
          expect(version).to.have.property('active');
          expect(version).to.have.property('name');
          expect(version).to.have.property('html_content');
          expect(version).to.have.property('subject');
          email.sgRequest('DELETE', `/templates/${template.id}`).then(() => {
            spy.restore();
            done();
          });
        });
    });
  });

  it('updateVersion()', function(done) {
    let spy = sinon.spy(email, 'sgRequest');
    const templateName = 'test-template-name';
    email.createTemplate(templateName).then(template => {
      const versionName = 'version-name';
      const htmlContent = '<div>{{ title }}</div>';
      email
        .createVersion(template.id, versionName, htmlContent)
        .then(version => {
          email
            .updateVersion(
              version.id,
              template.id,
              'new-version-name',
              htmlContent
            )
            .then(updatedVersion => {
              expect(
                spy.calledWith(
                  'PATCH',
                  `/templates/${template.id}/versions/${version.id}`,
                  {
                    name: 'new-version-name',
                    html_content: htmlContent
                  }
                )
              ).to.be.ok;
              expect(updatedVersion).to.have.property('id');
              expect(updatedVersion).to.have.property('template_id');
              expect(updatedVersion).to.have.property('active');
              expect(updatedVersion).to.have.property('name');
              expect(updatedVersion).to.have.property('html_content');
              expect(updatedVersion).to.have.property('subject');
              email
                .sgRequest('DELETE', `/templates/${template.id}`)
                .then(() => {
                  spy.restore();
                  done();
                });
            });
        });
    });
  });

  it('getTemplateId() - Get from cache', function(done) {
    const templatePath = path.resolve(__dirname, './template_02.html');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');

    email.getTemplateId(templatePath).then(tid => {
      let createTemplateSpy = sinon.spy(email, 'createTemplate');
      let createVersionSpy = sinon.spy(email, 'createVersion');
      let updateVersionSpy = sinon.spy(email, 'updateVersion');
      let getTemplatesSpy = sinon.spy(email, 'getTemplates');
      email.getTemplateId(templatePath).then(templateId => {
        expect(getTemplatesSpy.callCount).to.be.equal(0);
        expect(createTemplateSpy.callCount).to.be.equal(0);
        expect(createVersionSpy.callCount).to.be.equal(0);
        expect(updateVersionSpy.callCount).to.be.equal(0);
        expect(templateId).to.be.a('string');
        expect(templateId).to.be.equal(tid);
        email.sgRequest('DELETE', `/templates/${templateId}`).then(() => {
          createTemplateSpy.restore();
          createVersionSpy.restore();
          getTemplatesSpy.restore();
          updateVersionSpy.restore();
          done();
        });
      });
    });
  });

  it('getTemplateId() - Create new template', function(done) {
    let createTemplateSpy = sinon.spy(email, 'createTemplate');
    let createVersionSpy = sinon.spy(email, 'createVersion');
    let getTemplatesSpy = sinon.spy(email, 'getTemplates');
    const templatePath = path.resolve(__dirname, './template_01.html');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const versionName = createHash(templateContent);

    email.getTemplateId(templatePath).then(templateId => {
      expect(getTemplatesSpy.calledWith()).to.be.ok;
      expect(
        createTemplateSpy.calledWith(
          `${email.prefix}template_01.html${email.postfix}`
        )
      ).to.be.ok;
      expect(
        createVersionSpy.calledWith(templateId, versionName, templateContent)
      ).to.be.ok;
      expect(templateId).to.be.a('string');
      email.sgRequest('DELETE', `/templates/${templateId}`).then(() => {
        createTemplateSpy.restore();
        createVersionSpy.restore();
        getTemplatesSpy.restore();
        done();
      });
    });
  });

  it('getTemplateId() - Template and version already existed', function(done) {
    const templatePath = path.resolve(__dirname, './template_02.html');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const versionName = createHash(templateContent);

    email
      .createTemplate(`${email.prefix}template_02.html${email.postfix}`)
      .then(template => {
        email
          .createVersion(template.id, versionName, templateContent)
          .then(version => {
            let createTemplateSpy = sinon.spy(email, 'createTemplate');
            let createVersionSpy = sinon.spy(email, 'createVersion');
            let getTemplatesSpy = sinon.spy(email, 'getTemplates');
            email.getTemplateId(templatePath).then(templateId => {
              expect(getTemplatesSpy.calledWith()).to.be.ok;
              expect(createTemplateSpy.callCount).to.be.equal(0);
              expect(createVersionSpy.callCount).to.be.equal(0);
              expect(templateId).to.be.a('string');
              expect(templateId).to.be.equal(template.id);
              email.sgRequest('DELETE', `/templates/${templateId}`).then(() => {
                createTemplateSpy.restore();
                createVersionSpy.restore();
                getTemplatesSpy.restore();
                done();
              });
            });
          });
      });
  });

  it('getTemplateId() - Update version content', function(done) {
    const templatePath = path.resolve(__dirname, './template_01.html');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const versionName = createHash(templateContent);

    email
      .createTemplate(`${email.prefix}template_01.html${email.postfix}`)
      .then(template => {
        email
          .createVersion(
            template.id,
            createHash(templateContent + '<br/>'),
            templateContent + '<br/>'
          )
          .then(version => {
            let createTemplateSpy = sinon.spy(email, 'createTemplate');
            let createVersionSpy = sinon.spy(email, 'createVersion');
            let updateVersionSpy = sinon.spy(email, 'updateVersion');
            let getTemplatesSpy = sinon.spy(email, 'getTemplates');
            email.getTemplateId(templatePath).then(templateId => {
              expect(getTemplatesSpy.calledWith()).to.be.ok;
              expect(createTemplateSpy.callCount).to.be.equal(0);
              expect(createVersionSpy.callCount).to.be.equal(0);
              expect(
                updateVersionSpy.calledWith(
                  version.id,
                  templateId,
                  versionName,
                  templateContent
                )
              ).to.be.ok;
              expect(templateId).to.be.a('string');
              expect(templateId).to.be.equal(template.id);
              email.sgRequest('DELETE', `/templates/${templateId}`).then(() => {
                createTemplateSpy.restore();
                createVersionSpy.restore();
                getTemplatesSpy.restore();
                updateVersionSpy.restore();
                done();
              });
            });
          });
      });
  });

  it('getTemplateId() - Create new version', function(done) {
    const templatePath = path.resolve(__dirname, './template_02.html');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const versionName = createHash(templateContent);

    email
      .createTemplate(`${email.prefix}template_02.html${email.postfix}`)
      .then(template => {
        let createTemplateSpy = sinon.spy(email, 'createTemplate');
        let createVersionSpy = sinon.spy(email, 'createVersion');
        let updateVersionSpy = sinon.spy(email, 'updateVersion');
        let getTemplatesSpy = sinon.spy(email, 'getTemplates');
        email.getTemplateId(templatePath).then(templateId => {
          expect(getTemplatesSpy.calledWith()).to.be.ok;
          expect(createTemplateSpy.callCount).to.be.equal(0);
          expect(
            createVersionSpy.calledWith(
              templateId,
              versionName,
              templateContent
            )
          ).to.be.ok;
          expect(updateVersionSpy.callCount).to.be.equal(0);
          expect(templateId).to.be.a('string');
          expect(templateId).to.be.equal(template.id);
          email.sgRequest('DELETE', `/templates/${templateId}`).then(() => {
            createTemplateSpy.restore();
            createVersionSpy.restore();
            getTemplatesSpy.restore();
            updateVersionSpy.restore();
            done();
          });
        });
      });
  });

  const message = {
    to: 'user@tdev.app',
    from: 'admin@tdev.app',
    subject: `[Test] Sendgrid template helper`,
    template_path: path.resolve(__dirname, './template_01.html'),
    dynamic_template_data: {
      title: 'Testing'
    }
  };

  it('mangleMessage()', function(done) {
    let getTemplateIdSpy = sinon.spy(email, 'getTemplateId');
    email.mangleMessage(message).then(msg => {
      expect(getTemplateIdSpy.calledWith(message.template_path)).to.be.ok;
      expect(msg.to).to.be.equal(message.to);
      expect(msg.from).to.be.equal(message.from);
      expect(msg.subject).to.be.equal(message.subject);
      expect(msg.templatePath).to.be.equal(message.template_path);
      expect(msg.dynamicTemplateData).to.be.deep.equal({
        title: message.dynamic_template_data.title,
        subject: message.subject
      });
      expect(msg.templateId).to.be.a('string');
      email.sgRequest('DELETE', `/templates/${msg.templateId}`).then(() => {
        getTemplateIdSpy.restore();
        done();
      });
    });
  });

  it('send() - one message', function(done) {
    let sendSpy = sinon.spy(email.sgMail, 'send');
    let mangleMessageSpy = sinon.spy(email, 'mangleMessage');
    email.send(message).then(() => {
      const templateId =
        Email.templateIds[`${email.prefix}template_01.html${email.postfix}`];
      expect(mangleMessageSpy.calledWith(message)).to.be.ok;
      expect(sendSpy.callCount).to.be.equal(1);
      email.sgRequest('DELETE', `/templates/${templateId}`).then(() => {
        sendSpy.restore();
        mangleMessageSpy.restore();
        done();
      });
    });
  });

  it('send() - an array of messages', function(done) {
    let sendSpy = sinon.spy(email.sgMail, 'send');
    let mangleMessageSpy = sinon.spy(email, 'mangleMessage');
    let getTemplatesSpy = sinon.spy(email, 'getTemplates');
    message.template_path = path.resolve(__dirname, './template_02.html');
    email.send([message, message, message]).then(() => {
      const templateId =
        Email.templateIds[`${email.prefix}template_02.html${email.postfix}`];
      expect(mangleMessageSpy.callCount).to.be.equal(3);
      expect(getTemplatesSpy.callCount).to.be.equal(1);
      email.sgRequest('DELETE', `/templates/${templateId}`).then(() => {
        sendSpy.restore();
        mangleMessageSpy.restore();
        getTemplatesSpy.restore();
        done();
      });
    });
  });
});
