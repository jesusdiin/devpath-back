export interface OutboundCallOptions {
  to: string;
  from?: string;
  twimlUrl?: string;
  statusCallbackUrl?: string;
  record?: boolean;
  nombre?: string;
  correo?: string;
}

export interface CallRecord {
  sid: string;
  to: string;
  from: string;
  status: string;
  direction: string;
  duration: string | null;
  startTime: Date | null;
  endTime: Date | null;
  price: string | null;
  priceUnit: string | null;
}

export interface RecordingRecord {
  sid: string;
  callSid: string;
  status: string;
  duration: string | null;
  url: string;
  startTime: Date | null;
}

export interface TranscriptEntry {
  role: 'agent' | 'user';
  text: string;
}

export interface CallAnalysis {
  interesado: 'sí' | 'no' | 'tal vez';
  presupuesto: 'sí' | 'busca financiamiento' | 'no especificó';
  cuando_empieza: 'este mes' | '1-3 meses' | 'solo explorando' | 'no contestó';
  mejor_horario: string | null;
  notas: string;
  transcripcion: string;
}
