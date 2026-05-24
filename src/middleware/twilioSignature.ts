import type { NextFunction, Request, Response } from 'express';
import twilio from 'twilio';
import { twilioAuthToken } from '../config/twilio';

export function validateTwilioSignature(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['x-twilio-signature'] as string | undefined;
  const url = `${process.env.TWILIO_BASE_URL}${req.originalUrl}`;

  if (!signature) {
    res.status(403).json({ error: 'Missing Twilio signature' });
    return;
  }

  const isValid = twilio.validateRequest(twilioAuthToken, signature, url, req.body as Record<string, string>);

  if (!isValid) {
    res.status(403).json({ error: 'Invalid Twilio signature' });
    return;
  }

  next();
}
