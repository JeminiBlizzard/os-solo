import { describe, it, expect } from 'vitest';
import { randomBytes } from 'crypto';
import { encrypt, decrypt, validateVaultEncryptionKey, DecryptError, ConfigError } from '../src/crypto/aes-gcm.js';

describe('AES-256-GCM Encryption', () => {
  const testKey = randomBytes(32);

  describe('encrypt', () => {
    it('should encrypt plaintext and return formatted string', () => {
      const plaintext = 'hello world';
      const encrypted = encrypt(plaintext, testKey);

      // Should have format: iv:ciphertext:authTag
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);

      // All parts should be valid base64
      parts.forEach(part => {
        expect(Buffer.from(part, 'base64').toString('base64')).toBe(part);
      });
    });

    it('should produce different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'same text';
      const encrypted1 = encrypt(plaintext, testKey);
      const encrypted2 = encrypt(plaintext, testKey);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw ConfigError if key is wrong length', () => {
      const wrongKey = randomBytes(16); // Too short
      expect(() => encrypt('test', wrongKey)).toThrow(ConfigError);
      expect(() => encrypt('test', wrongKey)).toThrow('exactly 32 bytes');
    });

    it('should throw ConfigError if key is missing', () => {
      expect(() => encrypt('test', null as any)).toThrow(ConfigError);
    });
  });

  describe('decrypt', () => {
    it('should decrypt ciphertext back to original plaintext', () => {
      const plaintext = 'hello world';
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters and unicode', () => {
      const plaintext = 'Special: 你好世界 🚀 !@#$%^&*()';
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw DecryptError with wrong key (authTag mismatch)', () => {
      const plaintext = 'secret';
      const encrypted = encrypt(plaintext, testKey);
      const wrongKey = randomBytes(32);

      expect(() => decrypt(encrypted, wrongKey)).toThrow(DecryptError);
    });

    it('should throw DecryptError if ciphertext is tampered with', () => {
      const plaintext = 'secret';
      const encrypted = encrypt(plaintext, testKey);

      // Tamper with the ciphertext part
      const parts = encrypted.split(':');
      const tamperedCiphertext = Buffer.from(parts[1], 'base64');
      tamperedCiphertext[0] ^= 1; // Flip a bit
      parts[1] = tamperedCiphertext.toString('base64');
      const tampered = parts.join(':');

      expect(() => decrypt(tampered, testKey)).toThrow(DecryptError);
    });

    it('should throw DecryptError if authTag is tampered with', () => {
      const plaintext = 'secret';
      const encrypted = encrypt(plaintext, testKey);

      // Tamper with the authTag
      const parts = encrypted.split(':');
      const tamperedAuthTag = Buffer.from(parts[2], 'base64');
      tamperedAuthTag[0] ^= 1; // Flip a bit
      parts[2] = tamperedAuthTag.toString('base64');
      const tampered = parts.join(':');

      expect(() => decrypt(tampered, testKey)).toThrow(DecryptError);
    });

    it('should throw DecryptError if format is invalid', () => {
      expect(() => decrypt('invalid', testKey)).toThrow(DecryptError);
      expect(() => decrypt('invalid', testKey)).toThrow('Invalid encrypted string format');

      expect(() => decrypt('part1:part2', testKey)).toThrow(DecryptError);
      expect(() => decrypt('part1:part2:part3:part4', testKey)).toThrow(DecryptError);
    });

    it('should throw DecryptError if IV length is wrong', () => {
      const encrypted = encrypt('test', testKey);
      const parts = encrypted.split(':');

      // Create an invalid IV (wrong length)
      parts[0] = randomBytes(8).toString('base64'); // Should be 12 bytes
      const invalid = parts.join(':');

      expect(() => decrypt(invalid, testKey)).toThrow(DecryptError);
      expect(() => decrypt(invalid, testKey)).toThrow('Invalid IV length');
    });

    it('should throw ConfigError if key is wrong length', () => {
      const encrypted = encrypt('test', testKey);
      const wrongKey = randomBytes(16);

      expect(() => decrypt(encrypted, wrongKey)).toThrow(ConfigError);
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should successfully round-trip multiple times', () => {
      let plaintext = 'initial text';

      for (let i = 0; i < 10; i++) {
        const encrypted = encrypt(plaintext, testKey);
        const decrypted = decrypt(encrypted, testKey);
        expect(decrypted).toBe(plaintext);
        plaintext = `iteration ${i}: ${plaintext}`;
      }
    });
  });

  describe('validateVaultEncryptionKey', () => {
    it('should accept valid base64-encoded 32-byte key', () => {
      const validKey = randomBytes(32).toString('base64');
      const buffer = validateVaultEncryptionKey(validKey);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(32);
    });

    it('should throw ConfigError if key is missing', () => {
      expect(() => validateVaultEncryptionKey(undefined)).toThrow(ConfigError);
      expect(() => validateVaultEncryptionKey(undefined)).toThrow('required but not set');
    });

    it('should throw ConfigError if key is empty string', () => {
      expect(() => validateVaultEncryptionKey('')).toThrow(ConfigError);
    });

    it('should throw ConfigError if key is not base64', () => {
      expect(() => validateVaultEncryptionKey('not-valid-base64!!!')).toThrow(ConfigError);
    });

    it('should throw ConfigError if decoded key is wrong length', () => {
      const tooShort = randomBytes(16).toString('base64');
      expect(() => validateVaultEncryptionKey(tooShort)).toThrow(ConfigError);
      expect(() => validateVaultEncryptionKey(tooShort)).toThrow('exactly 32 bytes');

      const tooLong = randomBytes(64).toString('base64');
      expect(() => validateVaultEncryptionKey(tooLong)).toThrow(ConfigError);
      expect(() => validateVaultEncryptionKey(tooLong)).toThrow('exactly 32 bytes');
    });

    it('should include helpful error message with generation command', () => {
      try {
        validateVaultEncryptionKey(undefined);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as Error).message).toContain('randomBytes(32)');
      }
    });
  });

  describe('IV uniqueness', () => {
    it('should generate unique IVs for each encryption', () => {
      const plaintext = 'test';
      const ivs = new Set<string>();

      // Encrypt 100 times and collect IVs
      for (let i = 0; i < 100; i++) {
        const encrypted = encrypt(plaintext, testKey);
        const iv = encrypted.split(':')[0];
        ivs.add(iv);
      }

      // All IVs should be unique
      expect(ivs.size).toBe(100);
    });
  });
});
