import { mulaw } from 'alawmulaw';

/**
 * Converts base64-encoded mulaw 8kHz audio (from Twilio) to
 * base64-encoded PCM 16-bit 16kHz audio (expected by ElevenLabs).
 */
export function mulawToLinear16kHz(base64mulaw: string): string {
  // 1. Decode base64 → raw mulaw bytes
  const mulawBytes = Buffer.from(base64mulaw, 'base64');

  // 2. Decode mulaw → Int16Array PCM at 8kHz
  const pcm8k = mulaw.decode(mulawBytes) as Int16Array;

  // 3. Upsample 8kHz → 16kHz using linear interpolation for smoother waveform
  const pcm16k = new Int16Array(pcm8k.length * 2);
  for (let i = 0; i < pcm8k.length - 1; i++) {
    pcm16k[i * 2]     = pcm8k[i];
    pcm16k[i * 2 + 1] = (pcm8k[i] + pcm8k[i + 1]) >> 1;
  }
  // Last sample has no next sample to interpolate with
  const last = pcm8k.length - 1;
  pcm16k[last * 2]     = pcm8k[last];
  pcm16k[last * 2 + 1] = pcm8k[last];

  // 4. Convert Int16Array → Buffer (little-endian) → base64
  return Buffer.from(pcm16k.buffer).toString('base64');
}

/**
 * Converts base64-encoded PCM 16-bit 16kHz audio (from ElevenLabs) to
 * base64-encoded mulaw 8kHz audio (expected by Twilio).
 */
export function linear16kHzToMulaw(base64pcm: string): string {
  // 1. Decode base64 → Buffer → Int16Array PCM at 16kHz
  const buf = Buffer.from(base64pcm, 'base64');
  const pcm16k = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);

  // 2. Downsample 16kHz → 8kHz by averaging pairs of samples
  const pcm8k = new Int16Array(Math.floor(pcm16k.length / 2));
  for (let i = 0; i < pcm8k.length; i++) {
    pcm8k[i] = (pcm16k[i * 2] + pcm16k[i * 2 + 1]) >> 1;
  }

  // 3. Encode PCM 8kHz → mulaw → base64
  const mulawBytes = mulaw.encode(pcm8k) as Uint8Array;
  return Buffer.from(mulawBytes).toString('base64');
}
