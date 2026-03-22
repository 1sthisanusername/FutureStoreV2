// services/emailService.js — SendGrid transactional emails
// Install: npm install @sendgrid/mail
// Set SENDGRID_API_KEY in .env

let sgMail;
try { sgMail = require('@sendgrid/mail'); sgMail.setApiKey(process.env.SENDGRID_API_KEY); }
catch (_) { sgMail = null; }

const FROM = process.env.EMAIL_FROM || 'noreply@futurestore.com';

const send = async ({ to, subject, html, text }) => {
  if (!sgMail || !process.env.SENDGRID_API_KEY) {
    console.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
    return;
  }
  await sgMail.send({ to, from: FROM, subject, html, text });
};

// ── Templates ─────────────────────────────────────────────────────

const sendWelcome = (user) => send({
  to: user.email,
  subject: '👋 Welcome to Future Store!',
  html: `<h2>Hi ${user.name},</h2>
         <p>Thanks for joining Future Store. Start exploring 500+ hand-curated titles.</p>
         <a href="${process.env.FRONTEND_URL}" style="background:#C8501A;color:white;padding:12px 24px;border-radius:5px;text-decoration:none;display:inline-block;margin-top:12px">Browse Books →</a>`,
  text: `Hi ${user.name}, welcome to Future Store!`,
});

const sendOrderConfirmation = (order, user) => send({
  to: user.email,
  subject: `✅ Order Confirmed — ${order.order_number}`,
  html: `<h2>Order Confirmed!</h2>
         <p>Hi ${user.name}, your order <strong>${order.order_number}</strong> has been confirmed.</p>
         <p>Total: <strong>₹${(order.total * 84).toFixed(2)}</strong></p>
         <p>We'll notify you when it ships.</p>`,
  text: `Order ${order.order_number} confirmed. Total: ₹${(order.total * 84).toFixed(2)}`,
});

const sendShippingUpdate = (order, user) => send({
  to: user.email,
  subject: `🚚 Your Order ${order.order_number} Has Shipped!`,
  html: `<h2>Your order is on its way!</h2>
         <p>Tracking ID: <strong>${order.tracking_id || 'N/A'}</strong></p>`,
  text: `Order ${order.order_number} shipped. Tracking: ${order.tracking_id || 'N/A'}`,
});

const sendPasswordReset = (user, resetLink) => send({
  to: user.email,
  subject: '🔑 Reset Your Future Store Password',
  html: `<h2>Password Reset Request</h2>
         <p>Hi ${user.name}, click below to reset your password. This link expires in 1 hour.</p>
         <a href="${resetLink}" style="background:#C8501A;color:white;padding:12px 24px;border-radius:5px;text-decoration:none;display:inline-block;margin-top:12px">Reset Password</a>
         <p style="margin-top:16px;color:#888;font-size:12px">If you didn't request this, ignore this email.</p>`,
  text: `Reset link: ${resetLink}`,
});

const sendEmailVerification = (user, verifyLink) => send({
  to: user.email,
  subject: '📧 Verify Your Future Store Email',
  html: `<h2>Verify Your Email</h2>
         <p>Hi ${user.name}, please verify your email to activate your account.</p>
         <a href="${verifyLink}" style="background:#C8501A;color:white;padding:12px 24px;border-radius:5px;text-decoration:none;display:inline-block;margin-top:12px">Verify Email</a>`,
  text: `Verify your email: ${verifyLink}`,
});

const sendMarketingWelcome = (email) => send({
  to: email,
  subject: '🎁 You\'re In! Here\'s 10% Off Your First Order',
  html: `<h2>Welcome to Future Store Updates!</h2>
         <p>Use code <strong>WELCOME10</strong> for 10% off your first order.</p>`,
  text: 'Use code WELCOME10 for 10% off.',
});

module.exports = {
  sendWelcome, sendOrderConfirmation, sendShippingUpdate,
  sendPasswordReset, sendEmailVerification, sendMarketingWelcome,
};
