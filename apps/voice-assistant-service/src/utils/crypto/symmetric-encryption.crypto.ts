import crypto from 'crypto';
import { EMsgEncryptionAlgorithms } from '../enums';

/**
 * Class xử lý mã hóa/giải mã an toàn với AES-256-GCM
 * Cải tiến: IV ngẫu nhiên, Authentication tag, buffer pool
 */
export class SymmetricTextEncryptor {
  private readonly ALGORITHM = EMsgEncryptionAlgorithms.AES_256_GCM;
  private readonly IV_LENGTH = 12; // 96 bits cho GCM
  private readonly AUTH_TAG_LENGTH = 16; // 128 bits
  private readonly KEY_LENGTH = 32; // 256 bits

  constructor() {}

  /**
   * Tạo khóa mã hóa ngẫu nhiên 256-bit
   */
  generateEncryptionKey(): string {
    return crypto.randomBytes(this.KEY_LENGTH).toString('base64');
  }

  /**
   * Mã hóa với AES-256-GCM (authenticated encryption)
   * Format: [IV(12) + AuthTag(16) + Ciphertext]
   */
  encrypt(text: string, encryptionKey: string): string {
    // Decode base64 key
    const key = Buffer.from(encryptionKey, 'base64');

    if (key.length !== this.KEY_LENGTH) {
      throw new Error(`Invalid key length: expected ${this.KEY_LENGTH} bytes`);
    }

    // Tạo IV ngẫu nhiên cho mỗi lần mã hóa
    const iv = crypto.randomBytes(this.IV_LENGTH);

    // Tạo cipher với GCM mode
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    // Mã hóa
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);

    // Lấy authentication tag
    const authTag = cipher.getAuthTag();

    // Ghép: IV + AuthTag + Ciphertext
    const result = Buffer.concat([iv, authTag, encrypted]);

    return result.toString('base64');
  }

  /**
   * Giải mã dữ liệu đã mã hóa bởi encrypt()
   */
  decrypt(encryptedData: string, encryptionKey: string): string {
    // Decode
    const key = Buffer.from(encryptionKey, 'base64');
    const buffer = Buffer.from(encryptedData, 'base64');

    if (key.length !== this.KEY_LENGTH) {
      throw new Error(`Invalid key length: expected ${this.KEY_LENGTH} bytes`);
    }

    if (buffer.length < this.IV_LENGTH + this.AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted data format');
    }

    // Tách IV, AuthTag, Ciphertext
    const iv = buffer.subarray(0, this.IV_LENGTH);
    const authTag = buffer.subarray(
      this.IV_LENGTH,
      this.IV_LENGTH + this.AUTH_TAG_LENGTH,
    );
    const ciphertext = buffer.subarray(this.IV_LENGTH + this.AUTH_TAG_LENGTH);

    // Tạo decipher
    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Giải mã (sẽ throw nếu bị tamper)
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Mã hóa stream cho file lớn (tối ưu memory)
   */
  encryptStream(
    inputStream: NodeJS.ReadableStream,
    encryptionKey: string,
  ): NodeJS.ReadableStream {
    const key = Buffer.from(encryptionKey, 'base64');
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    // Emit IV trước
    const passthrough = new (require('stream').PassThrough)();
    passthrough.write(iv);

    inputStream
      .pipe(cipher)
      .on('end', () => {
        passthrough.write(cipher.getAuthTag());
        passthrough.end();
      })
      .pipe(passthrough);

    return passthrough;
  }
}
