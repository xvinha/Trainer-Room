import { env } from '../config/env';

export function generateStudentId(): string {
  const alphabet = (env.studentIdAlphabet || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789').split('');
  const length = Math.max(4, Math.min(16, Number(env.studentIdLength) || 8));
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function formatStudentId(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length <= 4) return cleaned;
  return cleaned.slice(0, 4) + '-' + cleaned.slice(4);
}
