import { Injectable, BadRequestException, HttpStatus } from '@nestjs/common'
import { ThumbnailService } from './thumbnail.service'
import type { Request, Response } from 'express'
import type {
  TUploadedPromise,
  TUploadMultipleFilesResult,
  TUploadGroupChatAvatar,
  TUploadReportImageRes,
  TUploadReportMessageFromUrl,
  TUploadResult,
} from './upload.type'
import {
  detectFileType,
  formatBytes,
  decodeFileName,
  typeToObject,
  convertFileMimeTypeToMessageMediaType,
  getMaxIdFromObjectArray,
} from '@/utils/helpers'
import { DevLogger } from '@/dev/dev-logger'
import type { TMessageMedia } from '@/utils/entities/message-media.entity'
import { S3FileService } from './s3-file.service'
import { extname } from 'path'
import * as https from 'https'
import * as http from 'http'
import { SymmetricTextEncryptor } from '@/utils/crypto/symmetric-text-encryptor.crypto'
import { readFile } from 'fs/promises'
import * as stream from 'stream'
import Busboy from 'busboy'
import { SymmetricFileEncryptor } from '@/utils/crypto/symmetric-file-encryptor.crypto'
import type { MessageMediaType } from '@prisma/client'
import { MessageMediaService } from './message-media.service'
import { UploadConfig } from './upload.config'

@Injectable()
export class UploadService {
  private symmetricTextEncryptor: SymmetricTextEncryptor
  private symmetricFileEncryptor: SymmetricFileEncryptor
  private readonly MAX_FILE_SIZE: number = 50 * 1024 * 1024 // 50MB
  // Định nghĩa các loại file được phép upload
  private readonly allowedMimeTypes = {
    // Images
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/webp': 'image',
    'image/bmp': 'image',
    'image/svg+xml': 'image',
    'image/tiff': 'image',
    'image/heic': 'image',

    // Videos
    'video/mp4': 'video',
    'video/avi': 'video',
    'video/mov': 'video',
    'video/wmv': 'video',
    'video/mpeg': 'video',
    'video/webm': 'video',
    'video/3gpp': 'video',
    'video/x-matroska': 'video',
    'video/x-flv': 'video',

    // Documents
    'application/pdf': 'document',
    'application/msword': 'document', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document', // .docx
    'application/vnd.ms-excel': 'document', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document', // .xlsx
    'application/vnd.ms-powerpoint': 'document', // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document', // .pptx
    'text/plain': 'document', // .txt
    'text/csv': 'document', // .csv
    'application/zip': 'document',
    'application/gzip': 'archive', // .gz
    'text/html': 'document', // .html
    'application/json': 'document', // .json
    'text/markdown': 'document',

    // Audio
    'audio/mpeg': 'audio',
    'audio/mp3': 'audio',
    'audio/wav': 'audio',
    'audio/webm': 'audio',
    'audio/ogg': 'audio',
    'audio/aac': 'audio',
    'audio/flac': 'audio',
    'audio/mp4': 'audio',
  }
  // Map content types to extensions based on allowedMimeTypes
  private readonly contentTypeToExtension = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
    'image/tiff': 'tiff',
    'image/heic': 'heic',
    'video/mp4': 'mp4',
    'video/avi': 'avi',
    'video/mov': 'mov',
    'video/wmv': 'wmv',
    'video/mpeg': 'mpeg',
    'video/webm': 'webm',
    'video/3gpp': '3gp',
    'video/x-matroska': 'mkv',
    'video/x-flv': 'flv',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    'audio/mp4': 'm4a',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/zip': 'zip',
    'application/gzip': 'gz',
    'text/html': 'html',
    'application/json': 'json',
    'text/markdown': 'md',
  }

  constructor(
    private readonly thumbnailService: ThumbnailService,
    private s3FileService: S3FileService,
    private messageMediaService: MessageMediaService,
    private uploadConfig: UploadConfig
  ) {
    this.symmetricTextEncryptor = new SymmetricTextEncryptor()
    this.symmetricFileEncryptor = new SymmetricFileEncryptor()
  }

  async createMessageMedia(
    s3FileKey: string,
    msgMediaType: MessageMediaType,
    fileMimeType: string,
    originalFilename: string,
    fileSize: number,
    originalDek: string,
    iv: string,
    authTag: string
  ): Promise<TMessageMedia> {
    const messageMedia = await this.messageMediaService.createMessageMedia(
      this.s3FileService.createMessageMediaUrl(s3FileKey),
      msgMediaType,
      fileMimeType,
      this.symmetricTextEncryptor.encrypt(originalFilename, originalDek),
      fileSize,
      undefined,
      this.symmetricTextEncryptor.encrypt(originalDek, process.env.MESSAGES_ENCRYPTION_SECRET_KEY),
      iv,
      authTag
    )
    return messageMedia
  }

  async uploadMultipleFiles(req: Request, res: Response): Promise<void> {
    const busboy = Busboy({ headers: req.headers })
    const uploads: TUploadedPromise[] = []
    busboy.on('file', (fieldname, fileStream, fileInfo) => {
      const { mimeType } = fileInfo
      if (!this.allowedMimeTypes[mimeType]) return
      const filename = decodeFileName(fileInfo.filename)
      const fileKey = this.s3FileService.createS3FileKey(filename)
      const iv = this.symmetricFileEncryptor.generateRandomIV()
      const dek = this.symmetricFileEncryptor.generateEncryptionKey()
      const cipher = this.symmetricFileEncryptor.createStreamEncryptor(dek, iv)
      const passThrough = new stream.PassThrough()
      const abortController = new AbortController()
      const uploadId = getMaxIdFromObjectArray(uploads) + 1
      const sizeCounter = new stream.PassThrough()
      sizeCounter.on('data', ({ length }) => {
        uploads.find(({ id }) => id === uploadId)!.fileSize += length
      })
      cipher.on('end', () => {
        uploads.find(({ id }) => id === uploadId)!.authTag = cipher.getAuthTag().toString('base64')
      })
      stream.pipeline(fileStream, sizeCounter, cipher, passThrough, (error) => {
        if (error) {
          console.error('>>> file stream Pipeline error:', error)
          abortController.abort()
        }
      })
      const upload = this.s3FileService.createUploadStream(
        fileKey,
        passThrough,
        {
          encrypted: 'true',
        },
        abortController
      )
      uploads.push({
        promise: upload.done(),
        filename: filename,
        iv: iv.toString('base64'),
        fileType: mimeType,
        dek: dek.toString('base64'),
        id: uploadId,
        fileSize: 0,
        fileKey,
        authTag: '',
      })
    })
    busboy.on('finish', async () => {
      if (uploads.length === 0) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
          typeToObject<TUploadMultipleFilesResult>({
            success: false,
            message: 'No files uploaded',
            uploadedFiles: [],
          })
        )
      }
      res.status(HttpStatus.OK).json(
        typeToObject<TUploadMultipleFilesResult>({
          success: true,
          message: `${uploads.length} files processed`,
          uploadedFiles: await Promise.all<TUploadMultipleFilesResult['uploadedFiles'][number]>(
            uploads.map(
              async ({ promise, filename, iv, fileType, dek, fileSize, fileKey, authTag }) => {
                try {
                  const { Key, Location } = await promise
                  const { id } = await this.createMessageMedia(
                    fileKey,
                    convertFileMimeTypeToMessageMediaType(fileType),
                    fileType,
                    filename,
                    fileSize,
                    dek,
                    iv,
                    authTag
                  )
                  if (fileType.toLowerCase() === 'video') {
                    await this.createThumbnailForVideoFile(
                      this.s3FileService.createS3FileURL(fileKey),
                      fileKey,
                      id
                    )
                  }
                  return {
                    id,
                    fileType,
                    filename,
                    location: Location,
                    key: Key,
                    iv,
                  }
                } catch (error) {
                  console.error('>>> error when Busboy finish:', error)
                  return {
                    error: error.message,
                  }
                }
              }
            )
          ),
        })
      )
    })
    req.pipe(busboy)
  }

  async createMessageMediaNonEncrypted(
    uploadedFileUrl: string,
    file: Express.Multer.File,
    originalFilename: string,
    originalDek?: string,
    iv?: string
  ): Promise<TMessageMedia> {
    const messageMedia = await this.messageMediaService.createMessageMedia(
      uploadedFileUrl,
      detectFileType(file),
      file.mimetype,
      originalDek
        ? this.symmetricTextEncryptor.encrypt(originalFilename, originalDek)
        : originalFilename,
      file.size,
      undefined,
      originalDek
        ? this.symmetricTextEncryptor.encrypt(
            originalDek,
            process.env.MESSAGES_ENCRYPTION_SECRET_KEY
          )
        : undefined,
      iv
    )
    return messageMedia
  }

  async createThumbnailForVideoFile(
    fileUrl: string,
    fileKey: string,
    messageMediaId: number
  ): Promise<string> {
    try {
      let thumbnailUrl: string
      const existingThumbnail = await this.thumbnailService.checkThumbnailExists(fileKey)
      if (existingThumbnail) {
        thumbnailUrl = existingThumbnail
      } else {
        thumbnailUrl = await this.thumbnailService.generateVideoThumbnail(fileUrl, fileKey)
      }
      await this.messageMediaService.updateThumbnailUrl(thumbnailUrl, messageMediaId)
      return thumbnailUrl
    } catch (error) {
      // Rollback video nếu lỗi
      await this.rollbackFileUpload(fileKey)
      throw new Error(`Failed to create thumbnail: ${error.message}`)
    }
  }

  async uploadFileNonEncrypted(file: Express.Multer.File): Promise<TUploadResult> {
    // Kiểm tra loại file
    const fileType = this.allowedMimeTypes[file.mimetype] as string | undefined
    if (!fileType) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`)
    }

    // Kiểm tra kích thước file
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 50MB limit')
    }

    // Chuẩn hóa tên file
    const decodedOriginalName = decodeFileName(file.originalname)
    const fileKey = decodedOriginalName.includes('/')
      ? decodedOriginalName
      : `${Date.now()}_${decodedOriginalName}`

    let uploadedFileUrl: string | null = null

    try {
      await this.s3FileService.saveFile(fileKey, file.buffer, file.mimetype)

      uploadedFileUrl = this.s3FileService.createS3FileURL(fileKey)

      const messageMedia = await this.createMessageMediaNonEncrypted(
        uploadedFileUrl,
        file,
        decodedOriginalName
      )

      const result: TUploadResult = {
        id: messageMedia.id,
        url: messageMedia.url,
        fileType: messageMedia.type,
        fileName: messageMedia.fileName,
        fileSize: formatBytes(messageMedia.fileSize),
      }

      // Nếu là video → tạo thumbnail
      if (fileType.toLowerCase() === 'video') {
        result.thumbnailUrl = await this.createThumbnailForVideoFile(
          uploadedFileUrl,
          fileKey,
          messageMedia.id
        )
      }

      return result
    } catch (error) {
      // Nếu có lỗi và file đã upload thì rollback
      if (uploadedFileUrl) {
        await this.rollbackFileUpload(fileKey)
      }
      throw error
    }
  }

  /**
   * Rollback: Xóa file đã upload lên S3
   */
  private async rollbackFileUpload(fileKey: string): Promise<void> {
    try {
      await this.s3FileService.deleteFileByKey(fileKey)
    } catch (error) {
      DevLogger.logError(`Rollback File Upload error: ${error.message}`)
      throw error
    }
  }

  /**
   * Xoá file bất kỳ trên S3 theo url
   */
  public async deleteFileByUrl(fileUrl: string): Promise<void> {
    try {
      await this.s3FileService.deleteFileByURL(fileUrl)
    } catch (error: any) {
      DevLogger.logError(`Delete File error: ${error.message}`)
      throw error
    }
  }

  /**
   * Upload report image to S3
   */
  async uploadReportImage(file: Express.Multer.File): Promise<TUploadReportImageRes> {
    // Create fileKey with report-image folder
    const originalName = file.originalname
    const timestamp = Date.now()
    const fileKey = `report-image/${timestamp}_${originalName}`

    // Create a modified file object with custom key
    const modifiedFile = {
      ...file,
      originalname: fileKey, // Override originalname to use our custom key
    }

    const result = await this.uploadFileNonEncrypted(modifiedFile)
    return { url: result.url }
  }

  /**
   * Upload report message media to S3
   */
  async uploadReportMessageMedia(
    filePath: string,
    messageId: number,
    contentType: string
  ): Promise<TUploadReportImageRes> {
    const fileBuffer = await readFile(filePath)

    // Extract file extension from file path
    const fileExtension =
      extname(filePath).substring(1) || this.getExtensionFromContentType(contentType)
    const fileKey = `report-message/${Date.now()}_message-${messageId}.${fileExtension}`

    // Get proper content type based on file extension
    const properContentType = this.getContentTypeFromExtension(fileExtension) || contentType

    await this.s3FileService.saveFile(fileKey, fileBuffer, properContentType)

    // Trả về URL public (nếu bucket public) hoặc URL dạng S3
    const fileUrl = `https://${this.s3FileService.getS3BucketName()}.s3.${this.s3FileService.getS3Region()}.amazonaws.com/${fileKey}`

    return { url: fileUrl }
  }

  /**
   * Download file from URL and upload to S3 as report message media (AWS SDK v3)
   */
  async uploadReportMessageFromUrl(
    fileUrl: string,
    messageId: number,
    contentType: string,
    retryCount: number = 0
  ): Promise<TUploadReportMessageFromUrl> {
    const maxRetries = 3
    const timeout = 30000 // 30s

    return new Promise((resolve, reject) => {
      const protocol = fileUrl.startsWith('https:') ? https : http

      const request = protocol.get(fileUrl, { timeout }, (response: any) => {
        if (response.statusCode !== 200) {
          const error = new Error(`Failed to download file: HTTP ${response.statusCode}`)
          if (retryCount < maxRetries) {
            setTimeout(
              () =>
                this.uploadReportMessageFromUrl(fileUrl, messageId, contentType, retryCount + 1)
                  .then(resolve)
                  .catch(reject),
              2000 * (retryCount + 1)
            )
            return
          }
          reject(error)
          return
        }

        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))

        response.on('end', async () => {
          try {
            const fileBuffer = Buffer.concat(chunks)

            // Lấy extension từ URL
            const urlParts = fileUrl.split('?')[0]
            const fileName = urlParts.split('/').pop() || 'file'
            const fileExtension = fileName.includes('.')
              ? fileName.split('.').pop() || this.getExtensionFromContentType(contentType)
              : this.getExtensionFromContentType(contentType)

            const fileKey = `report-message/${Date.now()}_message-${messageId}.${fileExtension}`
            const properContentType = this.getContentTypeFromExtension(fileExtension) || contentType

            try {
              await this.s3FileService.saveFile(fileKey, fileBuffer, properContentType)
            } catch (s3Error) {
              if (retryCount < maxRetries) {
                setTimeout(
                  () =>
                    this.uploadReportMessageFromUrl(fileUrl, messageId, contentType, retryCount + 1)
                      .then(resolve)
                      .catch(reject),
                  2000 * (retryCount + 1)
                )
                return
              }
              throw s3Error
            }

            const fileUrlResult = `https://${this.s3FileService.getS3BucketName()}.s3.${this.s3FileService.getS3Region()}.amazonaws.com/${fileKey}`
            resolve({ url: fileUrlResult })
          } catch (error) {
            reject(error)
          }
        })

        response.on('error', (error: any) => {
          const downloadError = new Error(`Failed to download file: ${error.message}`)
          if (retryCount < maxRetries) {
            setTimeout(
              () =>
                this.uploadReportMessageFromUrl(fileUrl, messageId, contentType, retryCount + 1)
                  .then(resolve)
                  .catch(reject),
              2000 * (retryCount + 1)
            )
            return
          }
          reject(downloadError)
        })
      })

      request.on('error', (error: any) => {
        const connectError = new Error(`Failed to connect to URL: ${error.message}`)
        if (retryCount < maxRetries) {
          setTimeout(
            () =>
              this.uploadReportMessageFromUrl(fileUrl, messageId, contentType, retryCount + 1)
                .then(resolve)
                .catch(reject),
            2000 * (retryCount + 1)
          )
          return
        }
        reject(connectError)
      })

      request.setTimeout(timeout, () => {
        request.destroy()
        const timeoutError = new Error(`Request timeout after ${timeout}ms`)
        if (retryCount < maxRetries) {
          setTimeout(
            () =>
              this.uploadReportMessageFromUrl(fileUrl, messageId, contentType, retryCount + 1)
                .then(resolve)
                .catch(reject),
            2000 * (retryCount + 1)
          )
          return
        }
        reject(timeoutError)
      })
    })
  }

  /**
   * Get file extension from content type
   */
  private getExtensionFromContentType(contentType: string): string {
    // Check if content type is in allowedMimeTypes
    if (this.allowedMimeTypes[contentType]) {
      return this.contentTypeToExtension[contentType] || 'bin'
    }
    return 'bin'
  }

  /**
   * Get content type from file extension
   */
  private getContentTypeFromExtension(extension: string): string {
    const contentType = this.uploadConfig.getFileExtToMimeTypeMappings()[extension.toLowerCase()]
    // Verify that the content type is in allowedMimeTypes
    if (contentType && this.allowedMimeTypes[contentType]) {
      return contentType
    }
    return 'application/octet-stream'
  }

  async uploadGroupChatAvatar(file: Express.Multer.File): Promise<TUploadGroupChatAvatar> {
    const fileBuffer = file.buffer
    const uploadKey = this.s3FileService.createS3FileKey(file.originalname)
    await this.s3FileService.saveFile(uploadKey, fileBuffer, file.mimetype)
    return {
      url: `https://${this.s3FileService.getS3BucketName()}.s3.${this.s3FileService.getS3Region()}.amazonaws.com/${uploadKey}`,
    }
  }

  async deleteGroupChatAvatar(avatarUrl: string): Promise<void> {
    await this.s3FileService.deleteFileByKey(this.s3FileService.extractObjectKeyFromUrl(avatarUrl))
  }
}
