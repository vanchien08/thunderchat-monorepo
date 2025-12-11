import crypto from 'crypto'
import { EMsgEncryptionAlgorithms } from '@/utils/enums'

/**
 * Class xử lý mã hóa và giải mã text với khóa đã cho
 * Sử dụng AES-256-ECB cho mã hóa và giải mã
 */
export class SymmetricEncryptor {
   private readonly ALGORITHM: string

   constructor(algorithm: EMsgEncryptionAlgorithms) {
      this.ALGORITHM = algorithm
   }

   /**
    * Tạo khóa mã hóa từ plain text
    * @returns Khóa mã hóa dạng string
    */
   generateSecretKey(): string {
      return crypto.randomBytes(32).toString('hex')
   }

   /**
    * Mã hóa text với khóa đã cho
    * @param text - Text cần mã hóa
    * @param encryptionKey - Khóa mã hóa
    * @returns Text đã được mã hóa dạng hex
    */
   encrypt(text: string, encryptionKey: string): string {
      const cipher = crypto.createCipheriv(this.ALGORITHM, encryptionKey, null)
      let encrypted = cipher.update(text, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      return encrypted
   }

   /**
    * Giải mã text đã được mã hóa
    * @param encrypted - Text đã mã hóa dạng hex
    * @param encryptionKey - Khóa mã hóa
    * @returns Text đã được giải mã
    */
   decrypt(encrypted: string, encryptionKey: string): string {
      const decipher = crypto.createDecipheriv(this.ALGORITHM, encryptionKey, null)
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
   }
}
