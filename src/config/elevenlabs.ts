import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env['ELEVENLABS_API_KEY'];
const agentId = process.env['ELEVENLABS_AGENT_ID'];

if (!apiKey || !agentId) {
  throw new Error('ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID must be set');
}

export const elevenLabsApiKey = apiKey;
export const elevenLabsAgentId = agentId;
