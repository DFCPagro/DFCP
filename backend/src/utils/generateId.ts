import crypto from 'crypto';
export default function generateId(prefix = ''): string {
  return prefix + crypto.randomBytes(8).toString('hex');
}
