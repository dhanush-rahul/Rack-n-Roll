require('dotenv').config();
const nodemailer = require('nodemailer');
const { getSmtpConfig, buildTransportOptions } = require('../src/services/email.service');

const smtp = getSmtpConfig();

console.log('MAIL_DELIVERY_MODE:', process.env.MAIL_DELIVERY_MODE || '(not set)');
console.log('SMTP_HOST:', smtp.host || '(missing)');
console.log('SMTP_USER:', smtp.user || '(missing)');
console.log('SMTP_FROM_EMAIL:', smtp.fromEmail || '(missing)');
console.log('SMTP_PASS length:', smtp.pass ? smtp.pass.length : 0);

if (!smtp.host || !smtp.user || !smtp.pass || !smtp.fromEmail) {
  console.error('\nMissing one or more SMTP settings in backend/.env');
  process.exit(1);
}

if (smtp.isGmail && smtp.pass.length !== 16) {
  console.warn('\nWarning: Gmail App Passwords are usually 16 characters (spaces are ignored).');
}

(async () => {
  const transporter = nodemailer.createTransport(buildTransportOptions(smtp));

  try {
    await transporter.verify();
    console.log('\nSMTP verification succeeded.');
    process.exit(0);
  } catch (error) {
    console.error('\nSMTP verification failed.');
    console.error('Code:', error.code || '(none)');
    console.error('Message:', error.message || error);

    if (smtp.isGmail) {
      console.error('\nGmail checklist:');
      console.error('1. Enable 2-Step Verification on the Google account');
      console.error('2. Create a new App Password: https://myaccount.google.com/apppasswords');
      console.error('3. Set SMTP_PASS to the 16-character password (no spaces needed)');
      console.error('4. SMTP_USER and SMTP_FROM_EMAIL must match that Gmail address');
      console.error('5. Restart the backend after changing backend/.env');
    }

    process.exit(1);
  }
})();
