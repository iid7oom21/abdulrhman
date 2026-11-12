import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'node:crypto';
import {deflateRawSync, inflateRawSync} from 'node:zlib';
import {CaseError} from './case-engine.js';

// Both compressed input and inflated JSON are bounded. In particular, a small
// authenticated token cannot turn into an unbounded allocation during restore.
export const MAX_CHECKPOINT_BYTES = 4 * 1024 * 1024;
const PREFIX = 'raven1.';
const AAD = Buffer.from('raven-case-checkpoint:v1', 'utf8');
const IV_BYTES = 12, TAG_BYTES = 16;
export const MAX_CHECKPOINT_LENGTH = PREFIX.length + Math.ceil((MAX_CHECKPOINT_BYTES + IV_BYTES + TAG_BYTES) * 4 / 3);
export const MAX_CHECKPOINT_BODY_BYTES = MAX_CHECKPOINT_LENGTH + 256;
export const checkpointSessionTag = id => createHash('sha256').update('raven-case-session-tag:v1:').update(id).digest('hex');

export function createCaseCheckpoint(keyValue) {
  let key;
  if (Buffer.isBuffer(keyValue) && keyValue.length === 32) key = Buffer.from(keyValue);
  else if (typeof keyValue === 'string' && /^[a-fA-F0-9]{64}$/.test(keyValue)) key = Buffer.from(keyValue, 'hex');
  else throw new CaseError('case_checkpoint_configuration_invalid');
  return {
    seal(payload) {
      const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
      if (bytes.length > MAX_CHECKPOINT_BYTES) throw new CaseError('checkpoint_too_large', 413);
      const compressed = deflateRawSync(bytes);
      if (compressed.length > MAX_CHECKPOINT_BYTES) throw new CaseError('checkpoint_too_large', 413);
      const iv = randomBytes(IV_BYTES), cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(AAD);
      const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
      return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
    },
    open(checkpoint) {
      if (typeof checkpoint !== 'string') throw new CaseError('checkpoint_invalid');
      if (checkpoint.length > MAX_CHECKPOINT_LENGTH) throw new CaseError('checkpoint_too_large', 413);
      try {
        if (!checkpoint.startsWith(PREFIX) || !/^[A-Za-z0-9_-]+$/.test(checkpoint.slice(PREFIX.length))) throw new Error();
        const encoded = checkpoint.slice(PREFIX.length), bytes = Buffer.from(encoded, 'base64url');
        if (bytes.toString('base64url') !== encoded || bytes.length <= IV_BYTES + TAG_BYTES || bytes.length > MAX_CHECKPOINT_BYTES + IV_BYTES + TAG_BYTES) throw new Error();
        const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, IV_BYTES));
        decipher.setAAD(AAD);
        decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
        const compressed = Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
        const json = inflateRawSync(compressed, {maxOutputLength:MAX_CHECKPOINT_BYTES});
        return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(json));
      } catch { throw new CaseError('checkpoint_invalid'); }
    },
  };
}
