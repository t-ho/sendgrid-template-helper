const path = require('path');
const expect = require('chai').expect;
const Email = require('../lib');

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
        templatePath: path.resolve(__dirname, '../dynamic-email-template.html')
      })
      .then(done)
      .catch(err => {
        expect(err.message).to.be.equal('Invalid SendGrid API Key');
        done();
      });
  });
});
