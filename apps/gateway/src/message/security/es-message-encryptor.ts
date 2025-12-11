import { SystemException } from '@/utils/exceptions/system.exception'
import { createHash } from 'crypto'

/**
 * Class xử lý mã hóa và giải mã tin nhắn của người dùng trước khi lưu vào Elasticsearch
 * Mã hóa từng ký tự Unicode thành chuỗi mã hóa có độ dài cố định 8 ký tự
 * Sử dụng SHA-256 để tạo mapping giữa ký tự và mã hóa
 * Hỗ trợ encode/decode tiếng Việt đầy đủ nhờ codePointAt.
 * Có sử dụng hash từ thư viện crypto để giải quyết va chạm.
 */
export default class ESMessageEncryptor {
  private readonly secretKey: string
  private readonly charMap: Map<number, string>
  private readonly reverseMap: Map<string, number>
  private readonly ENCRYPTED_MESSAGE_LENGTH: number = 8

  /**
   * Khởi tạo một instance của UserMessageEncryptor
   * @param secretKey - Khóa bí mật dùng để tạo hash cho việc mã hóa
   */
  constructor(secretKey: string, mappingsData: string | null) {
    this.secretKey = secretKey
    this.charMap = new Map()
    this.reverseMap = new Map()
    this.initMapping(mappingsData)
  }

  /**
   * Lấy khóa bí mật
   * @returns Khóa bí mật
   */
  getSecretKey(): string {
    return this.secretKey
  }

  /**
   * Mã hóa một ký tự Unicode thành chuỗi mã hóa
   * @param codePoint - Mã Unicode của ký tự cần mã hóa
   * @returns Chuỗi mã hóa của ký tự, độ dài cố định 8 ký tự
   * @throws {SystemException} Khi phát hiện va chạm hash
   * @private
   */
  private encryptChar(codePoint: number): string {
    if (this.charMap.has(codePoint)) return this.charMap.get(codePoint) as string

    const input = this.secretKey + codePoint.toString()
    const hash = createHash('sha256').update(input).digest('base64')

    // Cắt lấy 8 ký tự đầu tiên, đảm bảo độ dài cố định
    const encoded = hash.slice(0, this.ENCRYPTED_MESSAGE_LENGTH)

    // Kiểm tra va chạm
    if (this.reverseMap.has(encoded)) {
      throw new SystemException(
        `Hash collision between code point '${codePoint}' and '${this.reverseMap.get(encoded)}' -> same code: '${encoded}'`
      )
    }

    this.charMap.set(codePoint, encoded)
    this.reverseMap.set(encoded, codePoint)

    return encoded
  }

  /**
   * Mã hóa một chuỗi văn bản thành chuỗi mã hóa
   * @param input - Chuỗi văn bản cần mã hóa
   * @param saveMappedCharHandler - Hàm xử lý lưu trữ ký tự đã được mã hóa
   * @returns Chuỗi đã được mã hóa, mỗi ký tự được mã hóa thành 8 ký tự
   * @throws {SystemException} Khi gặp ký tự không hợp lệ
   */
  encrypt(input: string): string {
    let result = ''
    const inputLength = input.length
    for (let i = 0; i < inputLength; i++) {
      const codePoint = input.codePointAt(i)
      if (!codePoint) {
        throw new SystemException(`Invalid character at position ${i}`)
      }
      const code = this.encryptChar(codePoint)
      result += code
      // Bỏ qua surrogate pair nếu có (code point > 0xFFFF)
      if (codePoint > 0xffff) i++
    }
    return result
  }

  /**
   * Giải mã một chuỗi mã hóa thành văn bản gốc
   * @param encoded - Chuỗi đã được mã hóa cần giải mã
   * @returns Chuỗi văn bản gốc sau khi giải mã
   * @throws {SystemException} Khi chuỗi mã hóa không hợp lệ hoặc không thể giải mã
   */
  decrypt(encoded: string): string {
    if (encoded.length % this.ENCRYPTED_MESSAGE_LENGTH !== 0) {
      throw new SystemException('Invalid encoded string')
    }
    let result = ''
    for (let i = 0; i < encoded.length; i += this.ENCRYPTED_MESSAGE_LENGTH) {
      const chunk = encoded.slice(i, i + this.ENCRYPTED_MESSAGE_LENGTH)
      const codePoint = this.reverseMap.get(chunk)
      if (!codePoint) {
        throw new SystemException(`Cannot decode chunk '${chunk}'`)
      }
      result += String.fromCodePoint(codePoint)
    }
    return result
  }

  /**
   * Lấy mapping hiện tại giữa ký tự và mã hóa
   * @returns Chuỗi chứa các ký tự đã được map trước đây
   */
  getMappings(): string {
    let mappings: string = ''
    for (const key of this.charMap.keys()) {
      mappings += String.fromCodePoint(key)
    }
    return mappings
  }

  /**
   * Khởi tạo mapping từ dữ liệu đã lưu trữ
   * @param mapping - Chuỗi chứa các ký tự đã được map trước đây
   */
  private initMapping(mappingsData: string | null): void {
    if (!mappingsData) return
    const mappingLength = mappingsData.length
    for (let i = 0; i < mappingLength; i++) {
      const codePoint = mappingsData.codePointAt(i)
      if (!codePoint) {
        throw new SystemException(`Invalid character at position ${i}`)
      }
      this.encryptChar(codePoint)
    }
  }
}
