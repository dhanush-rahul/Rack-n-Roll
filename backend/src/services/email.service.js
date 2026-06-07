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

const normalizeEnvValue = (value) => {
  const trimmed = String(value || '').trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
};

const normalizeSmtpPassword = (value) => normalizeEnvValue(value).replace(/\s+/g, '');

const getSmtpConfig = () => {
  const host = normalizeEnvValue(process.env.SMTP_HOST);
  const user = normalizeEnvValue(process.env.SMTP_USER);
  const pass = normalizeSmtpPassword(process.env.SMTP_PASS);
  const fromEmail = normalizeEnvValue(process.env.SMTP_FROM_EMAIL);
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName: normalizeEnvValue(process.env.SMTP_FROM_NAME) || 'Rack-N-Roll',
    isGmail: /gmail\.com/i.test(host) || /@gmail\.com$/i.test(user),
  };
};

const buildTransportOptions = (smtp) => {
  if (smtp.isGmail) {
    return {
      service: 'gmail',
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    };
  }

  return {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    requireTLS: !smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  };
};

const mapSmtpError = (error, fallbackMessage, smtp = null) => {
  if (error instanceof ApiError) {
    return error;
  }

  const smtpCode = String(error?.code || '').trim();

  if (smtpCode === 'EAUTH') {
    if (smtp?.isGmail) {
      const passHint =
        smtp.pass.length === 16
          ? 'Gmail rejected the App Password. Create a new one at https://myaccount.google.com/apppasswords (requires 2-Step Verification), update SMTP_PASS, then restart the backend.'
          : 'Gmail App Passwords are 16 characters. Enable 2-Step Verification, create an App Password at https://myaccount.google.com/apppasswords, paste it in SMTP_PASS without spaces, then restart the backend.';

      return new ApiError(502, 'EMAIL_SEND_FAILED', passHint);
    }

    return new ApiError(
      502,
      'EMAIL_SEND_FAILED',
      'SMTP authentication failed. Check SMTP_USER and SMTP_PASS, then restart the backend.'
    );
  }

  if (smtpCode === 'ESOCKET' || smtpCode === 'ECONNECTION' || smtpCode === 'ETIMEDOUT') {
    return new ApiError(
      502,
      'EMAIL_SEND_FAILED',
      'Unable to connect to the SMTP server. Check SMTP_HOST, SMTP_PORT, and SMTP_SECURE.'
    );
  }

  return new ApiError(502, 'EMAIL_SEND_FAILED', error?.message || fallbackMessage);
};

const normalizeAttachmentBuffer = (buffer) => {
  if (!buffer) {
    throw new ApiError(500, 'EXPORT_ATTACHMENT_EMPTY', 'Tournament export file could not be generated');
  }

  if (Buffer.isBuffer(buffer)) {
    return buffer;
  }

  if (buffer instanceof ArrayBuffer) {
    return Buffer.from(buffer);
  }

  if (ArrayBuffer.isView(buffer)) {
    return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  return Buffer.from(buffer);
};

const createTransporter = async () => {
  const smtp = getSmtpConfig();

  if (!smtp.host || !smtp.user || !smtp.pass || !smtp.fromEmail) {
    throw new ApiError(
      503,
      'EMAIL_NOT_CONFIGURED',
      'Email delivery is not configured on the server'
    );
  }

  const transporter = nodemailer.createTransport(buildTransportOptions(smtp));

  try {
    await transporter.verify();
  } catch (error) {
    throw mapSmtpError(error, 'SMTP verification failed', smtp);
  }

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

const maskEmailAddress = (email) => {
  const normalized = String(email || '').trim();
  const atIndex = normalized.indexOf('@');

  if (atIndex <= 1) {
    return normalized;
  }

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  return `${local.charAt(0)}***@${domain}`;
};

const buildTournamentExportEmailText = ({ name, tournamentName }) => {
  const greetingName = name ? ` ${name}` : '';

  return [
    `Hello${greetingName},`,
    '',
    `Your Excel export for "${tournamentName}" is attached.`,
    '',
    'Rack-N-Roll',
  ].join('\n');
};

const buildTournamentExportEmailHtml = ({ name, tournamentName }) => {
  const safeName = String(name || 'there').replace(/[<>&"']/g, '');
  const safeTournamentName = String(tournamentName || 'Tournament').replace(/[<>&"']/g, '');

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <p>Hello ${safeName},</p>
      <p>Your Excel export for <strong>${safeTournamentName}</strong> is attached.</p>
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

  const smtp = getSmtpConfig();
  const transporter = await getTransporter();

  try {
    await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to: toEmail,
      subject: 'Your Rack-N-Roll password reset PIN',
      text: buildResetEmailText({ name: toName, pin, ttlMinutes }),
      html: buildResetEmailHtml({ name: toName, pin, ttlMinutes }),
    });
  } catch (error) {
    throw mapSmtpError(error, 'Unable to send password reset email', smtp);
  }

  return { deliveryMode: 'smtp' };
}

async function sendTournamentExportEmail({ toEmail, toName, tournamentName, filename, buffer }) {
  const deliveryMode = getDeliveryMode();

  if (deliveryMode === 'log') {
    throw new ApiError(
      503,
      'EMAIL_NOT_CONFIGURED',
      'Tournament export email requires SMTP. Set MAIL_DELIVERY_MODE=smtp and SMTP settings in backend/.env.'
    );
  }

  const smtp = getSmtpConfig();
  const transporter = await getTransporter();
  const attachmentBuffer = normalizeAttachmentBuffer(buffer);

  try {
    await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to: toEmail,
      subject: `${tournamentName} — tournament export`,
      text: buildTournamentExportEmailText({ name: toName, tournamentName }),
      html: buildTournamentExportEmailHtml({ name: toName, tournamentName }),
      attachments: [
        {
          filename,
          content: attachmentBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    });
  } catch (error) {
    throw mapSmtpError(error, 'Unable to send tournament export email', smtp);
  }

  return {
    deliveryMode: 'smtp',
    sentTo: maskEmailAddress(toEmail),
  };
}

module.exports = {
  sendPasswordResetPinEmail,
  sendTournamentExportEmail,
  getSmtpConfig,
  buildTransportOptions,
};
