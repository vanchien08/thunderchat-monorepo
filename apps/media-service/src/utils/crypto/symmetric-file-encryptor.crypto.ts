import crypto from 'crypto'
import { EMsgEncryptionAlgorithms } from '../enums'

/**
 * Class xử lý mã hóa/giải mã file với AES-256-GCM
 * Hỗ trợ: Stream processing, Buffer mode, Progress tracking
 */
export class SymmetricFileEncryptor {
  private readonly ALGORITHM = EMsgEncryptionAlgorithms.AES_256_GCM
  private readonly IV_LENGTH = 12
  private readonly KEY_LENGTH = 32

  constructor() {}

  /**
   * Tạo khóa mã hóa 256-bit (tương thích với SymmetricEncryptor)
   */
  generateEncryptionKey(): Buffer {
    return crypto.randomBytes(this.KEY_LENGTH)
  }

  generateRandomIV(): Buffer {
    return crypto.randomBytes(this.IV_LENGTH)
  }

  createStreamDecryptor(encryptionKey: Buffer, iv: Buffer): crypto.DecipherGCM {
    return crypto.createDecipheriv(this.ALGORITHM, encryptionKey, iv)
  }

  createStreamEncryptor(encryptionKey: Buffer, iv: Buffer): crypto.CipherGCM {
    return crypto.createCipheriv(this.ALGORITHM, encryptionKey, iv)
  }
}
