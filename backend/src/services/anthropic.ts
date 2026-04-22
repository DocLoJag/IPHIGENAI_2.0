import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const models = {
  tutor: env.ANTHROPIC_MODEL_TUTOR,
  curator: env.ANTHROPIC_MODEL_CURATOR,
};
