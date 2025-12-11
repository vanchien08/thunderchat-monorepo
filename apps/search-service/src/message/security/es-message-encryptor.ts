import { SystemException } from '@/utils/exceptions/system.exception'
import { createHash } from 'crypto'
import * as crypto from 'crypto'

/**
 * Class xử lý mã hóa và giải mã tin nhắn của người dùng trước khi lưu vào Elasticsearch
 * Mã hóa từng ký tự Unicode thành chuỗi mã hóa có độ dài cố định 8 ký tự
 * Có kiểm tra trùng lặp mã hóa ký tự (tức các ký tự chỉ xuất hiện 1 lần trong mapping)
 * Sử dụng SHA-256 để tạo mapping giữa ký tự và mã hóa
 * Hỗ trợ encode/decode tiếng Việt đầy đủ nhờ codePointAt.
 * Có sử dụng hash từ thư viện crypto để giải quyết va chạm.
 */
export default class ESMessageEncryptor {
  private readonly secretKey: string
  private readonly charMap: Map<number, string>
  private readonly reverseMap: Map<string, number>
  private readonly ENCRYPTED_MESSAGE_LENGTH: number = 8
  private readonly dek: string // Data Encryption Key dùng để mã hóa mappings và secretKey

  /**
   * Khởi tạo một instance của UserMessageEncryptor
   * @param secretKey - Khóa bí mật dùng để tạo hash cho việc mã hóa
   */
  constructor(secretKey: string, mappingsData: string | null, dek: string) {
    this.secretKey = secretKey
    this.charMap = new Map()
    this.reverseMap = new Map()
    this.dek = dek
    this.initMapping(mappingsData)
  }

  static generateESMessageSecretKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64')
  }

  /**
   * Lấy khóa bí mật
   * @returns Khóa bí mật
   */
  getSecretKey(): string {
    return this.secretKey
  }

  getDek(): string {
    return this.dek
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
   * Mã hóa một chuỗi văn bản thành chuỗi mã hóa, bỏ qua khoảng trắng
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
      // Bỏ qua khoảng trắng, xuống dòng -> chuyển thành khoảng trắng
      if (codePoint === 32 || codePoint === 10 || codePoint === 13) {
        // 32 là code point của space ' '
        result += ' '
      } else {
        const code = this.encryptChar(codePoint)
        result += code
      }
      // Bỏ qua surrogate pair nếu có (code point > 0xFFFF)
      if (codePoint > 0xffff) i++
    }
    return result
  }

  /**
   * Giải mã một chuỗi mã hóa thành văn bản gốc, bỏ qua khoảng trắng
   * @param encoded - Chuỗi đã được mã hóa cần giải mã
   * @returns Chuỗi văn bản gốc sau khi giải mã
   * @throws {SystemException} Khi chuỗi mã hóa không hợp lệ hoặc không thể giải mã
   */
  decrypt(encoded: string): string {
    let result = ''
    let i = 0
    const length = encoded.length
    while (i < length) {
      // Nếu gặp khoảng trắng, giữ nguyên
      if (encoded[i] === ' ') {
        result += ' '
        i++
        continue
      }
      // Đọc chunk 8 ký tự cho ký tự đã mã hóa
      const chunk = encoded.slice(i, i + this.ENCRYPTED_MESSAGE_LENGTH)
      if (chunk.length < this.ENCRYPTED_MESSAGE_LENGTH) {
        throw new SystemException(`Invalid encoded string: incomplete chunk at position ${i}`)
      }
      const codePoint = this.reverseMap.get(chunk)
      if (!codePoint) {
        throw new SystemException(`Cannot decode chunk '${chunk}' at position ${i}`)
      }
      result += String.fromCodePoint(codePoint)
      i += this.ENCRYPTED_MESSAGE_LENGTH
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
