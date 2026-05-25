import type { Request, Response } from 'express';
import twilio from 'twilio';
import { getCallRecordings, getCallStatus, makeOutboundCall } from '../services/twilio.service';
import type { OutboundCallOptions } from '../types/twilio.types';

export async function initiateOutbound(req: Request, res: Response): Promise<void> {
  const { to, from, twimlUrl, statusCallbackUrl, record } = req.body as OutboundCallOptions;

  if (!to) {
    res.status(400).json({ error: '"to" is required' });
    return;
  }

  try {
    const call = await makeOutboundCall({ to, from, twimlUrl, statusCallbackUrl, record });
    res.status(201).json(call);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: message });
  }
}

export function handleInbound(_req: Request, res: Response): void {
  res.type('text/xml').send(buildStreamTwiml());
}

export function getStreamTwiml(req: Request, res: Response): void {
  const nombre = typeof req.query['nombre'] === 'string' ? req.query['nombre'] : undefined;
  const correo = typeof req.query['correo'] === 'string' ? req.query['correo'] : undefined;
  res.type('text/xml').send(buildStreamTwiml(nombre, correo));
}

function buildStreamTwiml(nombre?: string, correo?: string): string {
  const baseUrl = (process.env['TWILIO_BASE_URL'] ?? '').replace(/^https?:\/\//, '');
  const twiml = new twilio.twiml.VoiceResponse();
  const connect = twiml.connect();
  const stream = connect.stream({ url: `wss://${baseUrl}/calls/stream` });
  if (nombre) {
    stream.parameter({ name: 'nombre', value: nombre });
    stream.parameter({ name: 'primer_nombre', value: nombre.split(' ')[0] ?? nombre });
  }
  if (correo) stream.parameter({ name: 'correo', value: correo });
  return twiml.toString();
}

export async function handleStatusCallback(req: Request, res: Response): Promise<void> {
  const { CallSid, CallStatus } = req.body as { CallSid: string; CallStatus: string };
  console.log(`Call ${CallSid} status: ${CallStatus}`);
  res.sendStatus(204);
}

export async function getRecordings(req: Request, res: Response): Promise<void> {
  try {
    const { callSid } = req.params;
    const recordings = await getCallRecordings(callSid);
    res.json(recordings);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: message });
  }
}

export async function fetchCallStatus(req: Request, res: Response): Promise<void> {
  try {
    const { callSid } = req.params;
    const call = await getCallStatus(callSid);
    res.json(call);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: message });
  }
}
