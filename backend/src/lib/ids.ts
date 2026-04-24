import { randomBytes } from 'node:crypto';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randId(len = 10): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export const id = {
  session: () => `sess-${randId(10)}`,
  exercise: () => `ex-${randId(10)}`,
  activity: () => `act-${randId(10)}`,
  completion: () => `done-${randId(10)}`,
  thread: () => `thread-${randId(10)}`,
  aiThread: () => `ai-thread-${randId(10)}`,
  message: () => `msg-${randId(10)}`,
  aiMessage: () => `ai-${randId(10)}`,
  artifact: () => `art-${randId(10)}`,
  tutorNote: () => `tnote-${randId(10)}`,
  proposal: () => `prop-${randId(10)}`,
  node: () => `n-${randId(6)}`,
  user: (role: string, hint: string) =>
    `${role}-${hint.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 24) || randId(6)}`,
  raw: randId,
};
