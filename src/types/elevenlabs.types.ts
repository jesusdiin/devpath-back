export interface ElevenLabsInitMessage {
  type: 'conversation_initiation_client_data';
  conversation_config_override: {
    agent?: { language?: string; prompt?: { prompt?: string }; first_message?: string };
    tts?: { optimize_streaming_latency?: number };
  };
  dynamic_variables?: Record<string, string>;
}

export interface ElevenLabsAudioMessage {
  type: 'audio';
  audio_event: { audio_base_64: string };
}

export interface ElevenLabsInterruptionMessage {
  type: 'interruption';
}

export interface ElevenLabsMetadataMessage {
  type: 'conversation_initiation_metadata';
  conversation_initiation_metadata_event: { conversation_id: string };
}

export interface ElevenLabsAgentResponseMessage {
  type: 'agent_response';
  agent_response_event: { agent_response: string };
}

export interface ElevenLabsUserTranscriptMessage {
  type: 'user_transcript';
  user_transcription_event: { user_transcript: string };
}

export type ElevenLabsMessage =
  | ElevenLabsAudioMessage
  | ElevenLabsInterruptionMessage
  | ElevenLabsMetadataMessage
  | ElevenLabsAgentResponseMessage
  | ElevenLabsUserTranscriptMessage
  | { type: string };

export interface TwilioConnectedMessage {
  event: 'connected';
  protocol: string;
  version: string;
}

export interface TwilioStartMessage {
  event: 'start';
  sequenceNumber: string;
  start: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters: Record<string, string>;
  };
  streamSid: string;
}

export interface TwilioMediaMessage {
  event: 'media';
  sequenceNumber: string;
  media: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  streamSid: string;
}

export interface TwilioStopMessage {
  event: 'stop';
  sequenceNumber: string;
  stop: { accountSid: string; callSid: string };
  streamSid: string;
}

export type TwilioStreamMessage =
  | TwilioConnectedMessage
  | TwilioStartMessage
  | TwilioMediaMessage
  | TwilioStopMessage;
