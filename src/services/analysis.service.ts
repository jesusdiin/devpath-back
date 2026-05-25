import Anthropic from '@anthropic-ai/sdk';
import { elevenLabsApiKey } from '../config/elevenlabs';
import type { CallAnalysis, TranscriptEntry } from '../types/twilio.types';
import { createLogger } from '../utils/logger';

const log = createLogger('analysis');

const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

const SYSTEM_PROMPT = `Eres un asistente que analiza transcripciones de llamadas de ventas inmobiliarias.
Extrae la información clave y devuelve ÚNICAMENTE un JSON válido, sin texto adicional, con esta estructura exacta:

{
  "interesado": "sí" | "no" | "tal vez",
  "presupuesto": "sí" | "busca financiamiento" | "no especificó",
  "cuando_empieza": "este mes" | "1-3 meses" | "solo explorando" | "no contestó",
  "mejor_horario": "<horario que mencionó>" | null,
  "notas": "<observaciones relevantes de la conversación>"
}

Reglas:
- "interesado": si mostró interés claro → "sí"; si rechazó o no quiere → "no"; si dudó o no fue claro → "tal vez"
- "presupuesto": si mencionó tener presupuesto disponible → "sí"; si habló de crédito/financiamiento → "busca financiamiento"; si no tocó el tema → "no especificó"
- "cuando_empieza": según el plazo que mencionó para comprar/rentar
- "mejor_horario": solo si pidió que le llamaran en otro momento o especificó horario; si no, null
- "notas": resumen breve de puntos relevantes (zona preferida, tipo de propiedad, objeciones, etc.)`;

async function fetchElevenLabsTranscript(conversationId: string): Promise<TranscriptEntry[]> {
  // Wait for ElevenLabs to finalize the conversation on their end
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
    { headers: { 'xi-api-key': elevenLabsApiKey } },
  );

  if (!res.ok) {
    throw new Error(`ElevenLabs API returned ${res.status}`);
  }

  const data = await res.json() as { transcript?: Array<{ role: string; message: string }> };
  const entries: TranscriptEntry[] = (data.transcript ?? []).map((t) => ({
    role: t.role === 'agent' ? 'agent' : 'user',
    text: t.message,
  }));

  log.info('fetched transcript from ElevenLabs', { conversationId, entries: entries.length });
  return entries;
}

export async function analyzeCall(
  conversationId: string,
  fallbackTranscript: TranscriptEntry[],
  leadData: Record<string, string> = {},
): Promise<CallAnalysis> {
  let transcript = fallbackTranscript;

  if (conversationId) {
    try {
      const fetched = await fetchElevenLabsTranscript(conversationId);
      if (fetched.length > 0) transcript = fetched;
    } catch (err) {
      log.warn('could not fetch ElevenLabs transcript, using accumulated', { err });
    }
  }

  const lead = {
    nombre: leadData['nombre'] ?? '',
    correo: leadData['correo'] ?? '',
    telefono: leadData['telefono'] ?? '',
  };

  if (transcript.length === 0) {
    return {
      ...lead,
      interesado: 'tal vez',
      presupuesto: 'no especificó',
      cuando_empieza: 'no contestó',
      mejor_horario: null,
      notas: 'La llamada no tuvo conversación registrada.',
      transcripcion: '',
    };
  }

  const transcriptText = transcript
    .map((t) => `${t.role === 'agent' ? 'Agente' : 'Usuario'}: ${t.text}`)
    .join('\n');

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Transcripción:\n\n${transcriptText}` }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const raw = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    const analysis = JSON.parse(raw) as CallAnalysis;
    analysis.transcripcion = transcriptText;
    Object.assign(analysis, lead);
    await postToWebhook(analysis);
    return analysis;
  } catch (err) {
    log.error('failed to analyze call', { err });
    return {
      ...lead,
      interesado: 'tal vez',
      presupuesto: 'no especificó',
      cuando_empieza: 'no contestó',
      mejor_horario: null,
      notas: 'Error al analizar la conversación.',
      transcripcion: transcriptText,
    };
  }
}

async function postToWebhook(analysis: CallAnalysis): Promise<void> {
  const url = process.env['WEBHOOK_MAKE'];
  if (!url) {
    log.warn('WEBHOOK_MAKE not set — skipping webhook');
    return;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analysis),
    });
    log.info('webhook posted', { status: res.status, url });
  } catch (err) {
    log.error('failed to post webhook', { err });
  }
}
