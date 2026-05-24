import dotenv from 'dotenv';
import twilio from 'twilio';

dotenv.config();

const accountSid = process.env['TWILIO_ACCOUNT_SID'];
const authToken = process.env['TWILIO_AUTH_TOKEN'];

if (!accountSid || !authToken) {
  throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
}

export const twilioClient = twilio(accountSid, authToken);
export const twilioAuthToken = authToken;
