import { Injectable } from '@nestjs/common'

@Injectable()
export class UploadConfig {
  getFileExtToMimeTypeMappings() {
    return {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
      tiff: 'image/tiff',
      heic: 'image/heic',
      mp4: 'video/mp4',
      avi: 'video/avi',
      mov: 'video/mov',
      wmv: 'video/wmv',
      mpeg: 'video/mpeg',
      webm: 'video/webm',
      '3gp': 'video/3gpp',
      mkv: 'video/x-matroska',
      flv: 'video/x-flv',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      webma: 'audio/webm',
      ogg: 'audio/ogg',
      aac: 'audio/aac',
      flac: 'audio/flac',
      m4a: 'audio/mp4',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      csv: 'text/csv',
      zip: 'application/zip',
      gz: 'application/gzip',
      html: 'text/html',
      json: 'application/json',
      md: 'text/markdown',
    }
  }
}
