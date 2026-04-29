import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Error thrown when decryption fails
 */
export class DecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptError';
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param plaintext - The text to encrypt
 * @param key - 32-byte encryption key (Buffer or Uint8Array)
 * @returns Encrypted string in format: base64(iv):base64(ciphertext):base64(authTag)
 */
export function encrypt(plaintext: string, key: Buffer | Uint8Array): string {
  if (!key || key.length !== 32) {
    throw new ConfigError('Encryption key must be exactly 32 bytes');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8');
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Return as base64-encoded string with colon separators
  return `${iv.toString('base64')}:${ciphertext.toString('base64')}:${authTag.toString('base64')}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * @param encryptedString - String in format: base64(iv):base64(ciphertext):base64(authTag)
 * @param key - 32-byte encryption key (Buffer or Uint8Array)
 * @returns Decrypted plaintext
 * @throws DecryptError if decryption fails (wrong key, tampered data, invalid format)
 */
export function decrypt(encryptedString: string, key: Buffer | Uint8Array): string {
  if (!key || key.length !== 32) {
    throw new ConfigError('Encryption key must be exactly 32 bytes');
  }

  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) {
      throw new DecryptError('Invalid encrypted string format. Expected: iv:ciphertext:authTag');
    }

    const ivB64 = parts[0]!;
    const ciphertextB64 = parts[1]!;
    const authTagB64 = parts[2]!;

    const iv = Buffer.from(ivB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    if (iv.length !== IV_LENGTH) {
      throw new DecryptError(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
    }

    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new DecryptError(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, undefined, 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  } catch (error) {
    if (error instanceof DecryptError || error instanceof ConfigError) {
      throw error;
    }
    // Crypto errors (auth tag mismatch, etc.) become DecryptError
    throw new DecryptError(`Decryption failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

/**
 * Validate that the VAULT_ENCRYPTION_KEY is present and correctly formatted
 *
 * @throws ConfigError if key is missing or invalid
 * @returns The validated encryption key as a Buffer
 */
export function validateVaultEncryptionKey(envKey?: string): Buffer {
  if (!envKey) {
    throw new ConfigError(
      'VAULT_ENCRYPTION_KEY environment variable is required but not set. ' +
      'Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }

  let keyBuffer: Buffer;
  try {
    keyBuffer = Buffer.from(envKey, 'base64');
  } catch (error) {
    throw new ConfigError(
      'VAULT_ENCRYPTION_KEY must be a valid base64-encoded string. ' +
      'Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }

  if (keyBuffer.length !== 32) {
    throw new ConfigError(
      `VAULT_ENCRYPTION_KEY must be exactly 32 bytes when decoded (currently ${keyBuffer.length} bytes). ` +
      'Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }

  return keyBuffer;
}
