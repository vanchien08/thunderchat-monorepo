import { EMessageMediaTypes } from '@/message/message.enum'
import { EGlobalMessages } from './enums'
import type { Express } from 'express'
import { Timestamp } from 'protos/generated/google/protobuf/timestamp'

/**
 * Định dạng kích thước file
 * @param bytes - Kích thước file
 * @param decimals - Số chữ số thập phân
 * @returns Kích thước file đã được định dạng
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

export function createDirectChatRoomName(directChatId: number): string {
  return `direct_chat_room-${directChatId}`
}

export function createGroupChatRoomName(groupChatId: number): string {
  return `group_chat_room-${groupChatId}`
}

export const convertDateToGrpcTimestamp = (date: Date): Timestamp => {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanos: (date.getTime() % 1000) * 1000000,
  }
}
