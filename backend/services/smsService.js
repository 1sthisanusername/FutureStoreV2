// services/smsService.js — Phone OTP via SMS gateway (Twilio / Fast2SMS)
// Install: npm install twilio
// Set TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM in .env

const crypto = require('crypto');
const pool   = require('../config/db');

// In-memory OTP store (use Redis in production)
const otpStore = new Map(); // phone → { otp, expiresAt, attempts }

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

let twilioClient = null;
try {
  const twilio = require('twilio');
  if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    console.log('📱  Twilio SMS enabled');
  }
} catch (_) {}

const sendOTP = async (phone) => {
  const otp = generateOTP();
  otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 });

  try {
    if (twilioClient) {
      await twilioClient.messages.create({
        body: `Your Future Store OTP is: ${otp}. Valid for 5 minutes.`,
        from: process.env.TWILIO_FROM,
        to:   phone,
      });
    } else {
      console.log(`[OTP MOCK] Phone: ${phone} | OTP: ${otp}`); // dev mode
    }
    return { sent: true };
  } catch (err) {
    console.error('Twilio send OTP error:', err.message);
    throw new Error('Failed to send OTP. Please try again later.');
  }
};

const verifyOTP = (phone, inputOtp) => {
  const record = otpStore.get(phone);
  if (!record) return { valid: false, message: 'OTP expired or not requested.' };
  if (Date.now() > record.expiresAt) { otpStore.delete(phone); return { valid: false, message: 'OTP expired.' }; }
  record.attempts++;
  if (record.attempts > 5) { otpStore.delete(phone); return { valid: false, message: 'Too many attempts.' }; }
  if (record.otp !== inputOtp.toString()) return { valid: false, message: 'Invalid OTP.' };
  otpStore.delete(phone);
  return { valid: true };
};

module.exports = { sendOTP, verifyOTP };
