import type { RecordingInstance } from 'twilio/lib/rest/api/v2010/account/call/recording';
import { twilioClient } from '../config/twilio';
import type { CallRecord, OutboundCallOptions, RecordingRecord } from '../types/twilio.types';

const DEFAULT_FROM = process.env['TWILIO_PHONE_NUMBER'] ?? '';
const BASE_URL = process.env['TWILIO_BASE_URL'] ?? '';

function mapCall(call: Awaited<ReturnType<typeof twilioClient.calls.create>>): CallRecord {
  return {
    sid: call.sid,
    to: call.to,
    from: call.from,
    status: call.status,
    direction: call.direction,
    duration: call.duration,
    startTime: call.startTime,
    endTime: call.endTime,
    price: call.price,
    priceUnit: call.priceUnit,
  };
}

export async function makeOutboundCall(options: OutboundCallOptions): Promise<CallRecord> {
  const twimlUrl = new URL(options.twimlUrl ?? `${BASE_URL}/calls/twiml/stream`);
  twimlUrl.searchParams.set('telefono', options.to);
  if (options.nombre) twimlUrl.searchParams.set('nombre', options.nombre);
  if (options.correo) twimlUrl.searchParams.set('correo', options.correo);

  const call = await twilioClient.calls.create({
    to: options.to,
    from: options.from ?? DEFAULT_FROM,
    url: twimlUrl.toString(),
    statusCallback: options.statusCallbackUrl ?? `${BASE_URL}/calls/status`,
    statusCallbackMethod: 'POST',
    record: options.record ?? false,
  });

  return mapCall(call);
}

export async function getCallStatus(callSid: string): Promise<CallRecord> {
  const call = await twilioClient.calls(callSid).fetch();
  return mapCall(call);
}

export async function getCallRecordings(callSid: string): Promise<RecordingRecord[]> {
  const recordings = await twilioClient.calls(callSid).recordings.list();

  return recordings.map((r: RecordingInstance) => ({
    sid: r.sid,
    callSid: r.callSid,
    status: r.status,
    duration: r.duration,
    url: `https://api.twilio.com${r.uri.replace('.json', '')}`,
    startTime: r.startTime,
  }));
}
