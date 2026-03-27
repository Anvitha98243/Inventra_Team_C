const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
};

const headerHtml = `
  <tr>
    <td style="background:#0f172a;padding:28px 40px;text-align:center;">
      <div style="font-size:30px;margin-bottom:6px;">⚡</div>
      <div style="color:#ffffff;font-size:20px;font-weight:700;">ElectroStock</div>
      <div style="color:#64748b;font-size:12px;margin-top:3px;">Smart Inventory Management</div>
    </td>
  </tr>`;

const footerHtml = (toEmail) => `
  <tr>
    <td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:18px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        &copy; ${new Date().getFullYear()} ElectroStock. This email was sent to ${toEmail}.
      </p>
    </td>
  </tr>`;

const wrapEmail = (body, toEmail) => `
<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        ${headerHtml}
        ${body}
        ${footerHtml(toEmail)}
      </table>
    </td></tr>
  </table>
</body></html>`;

// ── Welcome email on registration ─────────────────────────────────────────────
const sendWelcomeEmail = async (toEmail, username, role) => {
  const transporter = createTransporter();
  const roleLabel = role === 'admin' ? '🛡️ Admin' : '👤 Staff';
  const body = `
    <tr><td style="padding:36px 40px 32px;">
      <h2 style="margin:0 0 10px;font-size:22px;color:#111827;font-weight:700;">Welcome to ElectroStock! 🎉</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.7;">
        Hi <strong>${username}</strong>, your account has been created successfully.
        You're all set to manage your electronics inventory smarter and faster.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;">
            <table width="100%">
              <tr>
                <td style="font-size:13px;color:#9ca3af;padding:4px 0;">Username</td>
                <td style="font-size:14px;color:#111827;font-weight:600;text-align:right;">${username}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#9ca3af;padding:4px 0;">Email</td>
                <td style="font-size:14px;color:#111827;font-weight:600;text-align:right;">${toEmail}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#9ca3af;padding:4px 0;">Role</td>
                <td style="font-size:14px;color:#111827;font-weight:600;text-align:right;">${roleLabel}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center" style="padding:4px 0 20px;">
          <a href="${process.env.CLIENT_URL}/login"
            style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:13px 36px;border-radius:10px;font-size:15px;font-weight:600;">
            Go to Login →
          </a>
        </td></tr>
      </table>
      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
        Keep your login credentials safe. If you did not create this account, please contact support immediately.
      </p>
    </td></tr>`;

  await transporter.sendMail({
    from: `"ElectroStock" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: '🎉 Welcome to ElectroStock — Account Created',
    html: wrapEmail(body, toEmail),
  });
};

// ── OTP email for password reset ──────────────────────────────────────────────
const sendOTPEmail = async (toEmail, username, otp) => {
  const transporter = createTransporter();
  const digits = otp.split('');
  const digitBoxes = digits.map(d =>
    `<td style="width:44px;height:52px;text-align:center;vertical-align:middle;background:#f0f4ff;border:2px solid #2563eb;border-radius:8px;font-size:26px;font-weight:800;color:#1d4ed8;margin:0 4px;">${d}</td>`
  ).join('<td style="width:8px;"></td>');

  const body = `
    <tr><td style="padding:36px 40px 32px;">
      <h2 style="margin:0 0 10px;font-size:22px;color:#111827;font-weight:700;">Password Reset OTP</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
        Hi <strong>${username}</strong>, use the 6-digit OTP below to reset your password.
        This code expires in <strong>15 minutes</strong>. Do not share it with anyone.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td align="center">
          <table cellpadding="0" cellspacing="0">
            <tr>${digitBoxes}</tr>
          </table>
        </td></tr>
      </table>
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#92400e;">
          ⏱️ This OTP is valid for <strong>15 minutes</strong> only. Request a new one if it expires.
        </p>
      </div>
      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
        If you did not request a password reset, you can safely ignore this email.
      </p>
    </td></tr>`;

  await transporter.sendMail({
    from: `"ElectroStock" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: '🔐 Your ElectroStock Password Reset OTP',
    html: wrapEmail(body, toEmail),
  });
};

module.exports = { sendWelcomeEmail, sendOTPEmail };
