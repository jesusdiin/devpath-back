import WebSocket from 'ws';
import { elevenLabsAgentId, elevenLabsApiKey } from '../config/elevenlabs';
import { twilioClient } from '../config/twilio';
import { analyzeCall } from '../services/analysis.service';
import type {
  ElevenLabsAgentResponseMessage,
  ElevenLabsAudioMessage,
  ElevenLabsInitMessage,
  ElevenLabsMessage,
  ElevenLabsMetadataMessage,
  ElevenLabsUserTranscriptMessage,
  TwilioStreamMessage,
} from '../types/elevenlabs.types';
import type { TranscriptEntry } from '../types/twilio.types';
import { linear16kHzToMulaw, mulawToLinear16kHz } from '../utils/audio';
import { createLogger } from '../utils/logger';

const log = createLogger('stream');

export function handleMediaStream(twilioWs: WebSocket): void {
  let streamSid: string | null = null;
  let callSid: string | null = null;
  let conversationId: string | null = null;
  let twilioEnded = false;
  let elevenLabsWs: WebSocket | null = null;
  const transcript: TranscriptEntry[] = [];

  twilioWs.on('message', (raw: WebSocket.RawData) => {
    let msg: TwilioStreamMessage;
    try {
      msg = JSON.parse(raw.toString()) as TwilioStreamMessage;
    } catch (err) {
      log.error('failed to parse Twilio message', { err });
      return;
    }

    switch (msg.event) {
      case 'connected':
        log.debug('twilio connected', { protocol: msg.protocol, version: msg.version });
        break;

      case 'start':
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        log.info('twilio stream started', { streamSid, callSid, tracks: msg.start.tracks });
        elevenLabsWs = openElevenLabsConnection(
          twilioWs,
          streamSid,
          transcript,
          (id) => { conversationId = id; },
          () => callSid,
          () => twilioEnded,
          msg.start.customParameters,
        );
        break;

      case 'media':
        log.debug('twilio → elevenlabs audio', { bytes: msg.media.payload.length });
        if (elevenLabsWs?.readyState === WebSocket.OPEN) {
          const pcm = mulawToLinear16kHz(msg.media.payload);
          elevenLabsWs.send(JSON.stringify({ user_audio_chunk: pcm }));
        }
        break;

      case 'stop':
        log.info('twilio stream stopped', { streamSid: msg.streamSid });
        twilioEnded = true;
        elevenLabsWs?.close();
        analyzeCall(conversationId ?? '', transcript).then((analysis) => {
          log.info('call analysis', {});
          console.log('[call analysis]\n' + JSON.stringify(analysis, null, 2));
        });
        break;

      default:
        log.debug('twilio unknown event', msg);
    }
  });

  twilioWs.on('error', (err) => {
    log.error('twilio WebSocket error', { message: err.message });
    elevenLabsWs?.close();
  });

  twilioWs.on('close', (code, reason) => {
    log.info('twilio WebSocket closed', { code, reason: reason.toString() });
    elevenLabsWs?.close();
  });
}

function openElevenLabsConnection(
  twilioWs: WebSocket,
  streamSid: string,
  transcript: TranscriptEntry[],
  onConversationId: (id: string) => void,
  getCallSid: () => string | null,
  isTwilioEnded: () => boolean,
  leadData: Record<string, string>,
): WebSocket {
  const elLog = createLogger('elevenlabs');

  const ws = new WebSocket(
    `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${elevenLabsAgentId}`,
    { headers: { 'xi-api-key': elevenLabsApiKey } },
  );

  ws.on('open', () => {
    elLog.info('connected to ElevenLabs');

    const init: ElevenLabsInitMessage = {
      type: 'conversation_initiation_client_data',
      conversation_config_override: {
        agent: { language: 'es' },
        tts: { optimize_streaming_latency: 3 },
      },
      ...(Object.keys(leadData).length > 0 && { dynamic_variables: leadData }),
    };
    elLog.debug('sending init', init);
    ws.send(JSON.stringify(init));
  });

  let rawMsgCount = 0;

  ws.on('message', (raw: WebSocket.RawData) => {
    const rawStr = raw.toString();

    // Log primeros mensajes sin el payload de audio para ver la estructura real
    if (rawMsgCount++ < 6) {
      const preview = rawStr.replace(/"[A-Za-z0-9+/]{40,}"/g, '"<audio_data>"').slice(0, 400);
      elLog.debug('raw message', { preview });
    }

    let msg: ElevenLabsMessage;
    try {
      msg = JSON.parse(rawStr) as ElevenLabsMessage;
    } catch (err) {
      elLog.error('failed to parse ElevenLabs message', { err });
      return;
    }

    switch (msg.type) {
      case 'conversation_initiation_metadata': {
        const m = msg as ElevenLabsMetadataMessage;
        const cid = m.conversation_initiation_metadata_event.conversation_id;
        onConversationId(cid);
        elLog.info('conversation started', { conversationId: cid });
        break;
      }

      case 'audio': {
        const m = msg as ElevenLabsAudioMessage;
        const mulaw = linear16kHzToMulaw(m.audio_event.audio_base_64);
        elLog.debug('elevenlabs → twilio audio', { bytes: mulaw.length });
        if (twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid,
            media: { payload: mulaw },
          }));
        }
        break;
      }

      case 'interruption':
        elLog.info('interruption → clearing buffer');
        if (twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
        }
        break;

      case 'agent_response': {
        const m = msg as ElevenLabsAgentResponseMessage;
        const agentText = m.agent_response_event.agent_response;
        elLog.info('agent said', { text: agentText });
        transcript.push({ role: 'agent', text: agentText });
        break;
      }

      case 'user_transcript': {
        const m = msg as ElevenLabsUserTranscriptMessage;
        const userText = m.user_transcription_event.user_transcript;
        elLog.info('user said', { text: userText });
        transcript.push({ role: 'user', text: userText });
        break;
      }

      default:
        elLog.debug('unknown message type', msg);
    }
  });

  ws.on('error', (err) => {
    elLog.error('WebSocket error', { message: err.message });
  });

  ws.on('close', (code, reason) => {
    elLog.warn('WebSocket closed', { code, reason: reason.toString() });
    if (!isTwilioEnded() && transcript.length > 0) {
      const sid = getCallSid();
      if (sid) {
        twilioClient.calls(sid).update({ status: 'completed' })
          .then(() => elLog.info('call ended by agent'))
          .catch((err: unknown) => elLog.error('failed to end call', { err }));
      }
    }
  });

  return ws;
}
