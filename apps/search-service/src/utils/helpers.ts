import crypto from 'crypto'
import path from 'path'
import { Worker } from 'worker_threads'
import type { TRetryRequestOptions } from './types'
import type { Request } from 'express'
import { EMessageMediaTypes } from '@/message/message.enum'
import { EGlobalMessages } from './enums'

/**
 * Decode Multer's originalname (latin1) to UTF-8 so Unicode filenames display correctly
 */
export function decodeMulterFileName(originalName: string): string {
  if (!originalName) return originalName
  try {
    // Multer historically decodes headers using latin1, causing UTF-8 names to look garbled
    // Convert back to proper UTF-8 and normalize to NFC for consistent storage/display
    return Buffer.from(originalName, 'latin1').toString('utf8').normalize('NFC')
  } catch {
    return originalName
  }
}

/**
 * Mã hóa tên file, đầu ra có độ dài tối đa 64 ký tự
 * @param {string} originalFilename - Tên file gốc
 * @param {number} length - Độ dài của mã băm
 * @returns {string} Tên file đã mã hóa, bao gồm UUID và mã băm
 */
export function encodeFilename(originalFilename: string, length: number): string {
  // Lấy phần mở rộng của file
  const ext = path.extname(encodeURIComponent(originalFilename))

  // Tạo hash SHA-256 từ tên file gốc
  const hash = crypto.createHash('sha256').update(originalFilename).digest('hex').slice(0, length)

  // Kết hợp UUID và hash để tạo tên file duy nhất
  const uniqueId = crypto.randomBytes(16).toString('hex')

  return `${uniqueId}-${hash}${ext}`
}

/**
 * Hàm này dùng để ép kiểu một đối tượng về một kiểu cụ thể trong TypeScript.
 * @param rawObject - Đối tượng cần ép kiểu
 * @template T - Kiểu của đối tượng
 * @returns Đối tượng đã được ép kiểu
 */
export function typeToRawObject<T>(rawObject: T): T {
  return rawObject
}

/**
 * Tạo một worker mới
 * @param {string} workerPath - Đường dẫn đến file worker
 * @returns {Worker} Một worker mới
 */
export function createWorker(workerPath: string): Worker {
  return new Worker(workerPath)
}

/**
 * Hàm này dùng để thực hiện yêu cầu lại nhiều lần nếu có lỗi
 * @param {TRetryRequestExecutor<R>} requestExecutor - Hàm thực hiện yêu cầu
 * @param {TRetryRequestOptions} options - Các tùy chọn cho việc thực hiện yêu cầu lại
 * @returns {R} Kết quả của yêu cầu
 */
export async function retryAsyncRequest<R>(
  requestExecutor: () => Promise<R>,
  options?: TRetryRequestOptions
): Promise<R> {
  const { maxRetries = 3, onPreRetry } = options || {}
  let retriesCount = 0
  async function retryHandler(): Promise<R> {
    try {
      return await requestExecutor()
    } catch (error) {
      console.log('>>> error on retry Async Request:', error)
      if (retriesCount < maxRetries) {
        if (onPreRetry) onPreRetry(error, retriesCount)
        retriesCount++
        return await retryHandler()
      } else {
        throw error
      }
    }
  }
  return await retryHandler()
}

/**
 * Kiểm tra xem chuỗi input có chứa thẻ HTML hay không
 * @param {string} input - Chuỗi cần kiểm tra
 * @returns {string} Chuỗi đã được xử lý, nếu có thẻ HTML thì thay thế bằng '(Media)'
 */
export function replaceHTMLTagInMessageContent(input: string): string {
  // Regex kiểm tra thẻ HTML mở hoặc đóng
  const htmlTagRegex = /<([a-z][\w-]*)(\s[^>]*)?>.*?<\/\1>|<([a-z][\w-]*)(\s[^>]*)?\/?>/g
  return input.replace(htmlTagRegex, '(Media)')
}

/**
 * Xác định loại file từ buffer của file
 * @param {Express.Multer.File} file - File để xác định loại
 * @returns {Promise<EMessageMediaTypes>} Loại file
 */
export function detectFileType(file: Express.Multer.File): EMessageMediaTypes {
  const mime = file.mimetype

  // Special handling for WebM files
  if (
    file.originalname &&
    file.originalname.toLowerCase().endsWith('.webm') &&
    file.originalname.toLowerCase().includes('voice-')
  ) {
    return EMessageMediaTypes.AUDIO
  }

  // Special handling for audio files with .webm extension
  if (
    file.originalname &&
    file.originalname.toLowerCase().endsWith('.webm') &&
    mime === 'audio/webm'
  ) {
    return EMessageMediaTypes.AUDIO
  }

  if (mime.startsWith('image/')) return EMessageMediaTypes.IMAGE
  if (mime.startsWith('video/')) return EMessageMediaTypes.VIDEO

  // Kiểm tra document (pdf, word, excel, zip, rar...)
  if (
    mime === 'application/pdf' ||
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-powerpoint' ||
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mime === 'text/plain' ||
    mime === 'text/csv' ||
    mime === 'application/rtf' ||
    mime === 'application/vnd.oasis.opendocument.text' ||
    mime === 'application/vnd.oasis.opendocument.spreadsheet' ||
    mime === 'application/vnd.oasis.opendocument.presentation' ||
    mime === 'application/zip' ||
    mime === 'application/x-compressed' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'application/x-rar-compressed' ||
    mime === 'application/x-7z-compressed' ||
    mime === 'text/html' ||
    mime === 'application/json' ||
    mime === 'text/markdown'
  ) {
    return EMessageMediaTypes.DOCUMENT
  }

  // Kiểm tra archive files
  if (
    mime === 'application/gzip' ||
    mime === 'application/x-gzip' ||
    mime === 'application/x-tar' ||
    mime === 'application/x-bzip2' ||
    mime === 'application/x-bzip'
  ) {
    return EMessageMediaTypes.DOCUMENT
  }

  // Kiểm tra audio files
  if (
    mime === 'audio/mpeg' ||
    mime === 'audio/mp3' ||
    mime === 'audio/wav' ||
    mime === 'audio/webm' ||
    mime === 'audio/ogg' ||
    mime === 'audio/aac' ||
    mime === 'audio/flac' ||
    mime === 'audio/mp4'
  ) {
    return EMessageMediaTypes.AUDIO
  }

  // Kiểm tra các MIME types khác có thể bị thiếu
  if (
    mime === 'application/octet-stream' ||
    mime === 'application/x-download' ||
    mime === 'binary/octet-stream'
  ) {
    // Fallback: cố gắng đoán từ extension
    if (file.originalname) {
      const ext = file.originalname.toLowerCase().split('.').pop()
      if (ext && ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'bz'].includes(ext)) {
        return EMessageMediaTypes.DOCUMENT
      }
      if (ext && ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'webm'].includes(ext)) {
        return EMessageMediaTypes.AUDIO
      }
    }
    return EMessageMediaTypes.DOCUMENT // Default fallback
  }

  throw new Error(EGlobalMessages.UNKNOWN_FILE_TYPE)
}

/**
 * Định dạng kích thước file
 * @param {number} bytes - Kích thước file
 * @param {number} decimals - Số chữ số thập phân
 * @returns {string} Kích thước file đã được định dạng
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(dm))

  return `${value} ${sizes[i]}`
}

export function createDirectChatRoomName(directChatId: number): string {
  return `direct_chat_room-${directChatId}`
}

export function createGroupChatRoomName(groupChatId: number): string {
  return `group_chat_room-${groupChatId}`
}

export const isEmptyJSON = (json: object): boolean => {
  return Object.keys(json).length === 0
}

export const extractStringXHeader = (request: Request, headerName: string): string | null => {
  const headerValue = request.headers[headerName]
  return headerValue ? Buffer.from(headerValue as string, 'base64').toString('utf-8') : null
}
