const nodemailer = require('nodemailer');
const ApiError = require('../utils/ApiError');

let transporterPromise;

const getDeliveryMode = () => {
  const mode = String(process.env.MAIL_DELIVERY_MODE || '').trim().toLowerCase();

  if (mode === 'smtp' || mode === 'log') {
    return mode;
  }

  return process.env.SMTP_HOST ? 'smtp' : 'log';
};

const getSmtpConfig = () => ({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  fromEmail: process.env.SMTP_FROM_EMAIL,
  fromName: process.env.SMTP_FROM_NAME || 'Rack-N-Roll',
});

const createTransporter = async () => {
  const smtp = getSmtpConfig();

  if (!smtp.host || !smtp.user || !smtp.pass || !smtp.fromEmail) {
    throw new ApiError(
      503,
      'EMAIL_NOT_CONFIGURED',
      'Password reset email delivery is not configured on the server'
    );
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  await transporter.verify();
  return transporter;
};

const getTransporter = async () => {
  if (!transporterPromise) {
    transporterPromise = createTransporter().catch((error) => {
      transporterPromise = undefined;
      throw error;
    });
  }

  return transporterPromise;
};

const buildResetEmailText = ({ name, pin, ttlMinutes }) => {
  const greetingName = name ? ` ${name}` : '';

  return [
    `Hello${greetingName},`,
    '',
    'We received a request to reset your Rack-N-Roll password.',
    `Your password reset PIN is: ${pin}`,
    `This PIN expires in ${ttlMinutes} minutes.`,
    '',
    'If you did not request a password reset, you can ignore this email.',
    '',
    'Rack-N-Roll',
  ].join('\n');
};

const buildResetEmailHtml = ({ name, pin, ttlMinutes }) => {
  const safeName = String(name || 'there').replace(/[<>&"']/g, '');

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <p>Hello ${safeName},</p>
      <p>We received a request to reset your Rack-N-Roll password.</p>
      <p>Your password reset PIN is:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${pin}</p>
      <p>This PIN expires in ${ttlMinutes} minutes.</p>
      <p>If you did not request a password reset, you can ignore this email.</p>
      <p>Rack-N-Roll</p>
    </div>
  `;
};

async function sendPasswordResetPinEmail({ toEmail, toName, pin, ttlMinutes }) {
  const deliveryMode = getDeliveryMode();

  if (deliveryMode === 'log') {
    console.log(
      `[mail:log] Password reset PIN for ${toEmail}: ${pin} (expires in ${ttlMinutes} minutes)`
    );
    return { deliveryMode: 'log' };
  }

  const transporter = await getTransporter();
  const smtp = getSmtpConfig();

  await transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to: toEmail,
    subject: 'Your Rack-N-Roll password reset PIN',
    text: buildResetEmailText({ name: toName, pin, ttlMinutes }),
    html: buildResetEmailHtml({ name: toName, pin, ttlMinutes }),
  });

  return { deliveryMode: 'smtp' };
}

module.exports = {
  sendPasswordResetPinEmail,
};
