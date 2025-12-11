import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { DeleteObjectCommandOutput, PutObjectCommandOutput } from '@aws-sdk/client-s3'
import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import crypto from 'crypto'
import type { TFileMetadata } from './upload.type'
import stream from 'stream'
import { SymmetricFileEncryptor } from '@/utils/crypto/symmetric-file-encryptor.crypto'
import { Upload } from '@aws-sdk/lib-storage'
import { MessageMediaService } from './message-media.service'
import { typeToObject } from '@/utils/helpers'
import { UploadConfig } from './upload.config'
import mime from 'mime-types'
import type { TMessageMedia } from '@/utils/entities/message-media.entity'
import type { Response } from 'express'
import { IncomingHttpHeaders } from 'http'
import { ERoutes } from '@/utils/enums'
import { SymmetricTextEncryptor } from '@/utils/crypto/symmetric-text-encryptor.crypto'

@Injectable()
export class S3FileService {
  private s3Client: S3Client
  private symmetricFileEncryptor: SymmetricFileEncryptor
  private symmetricTextEncryptor: SymmetricTextEncryptor
  private readonly uploadFolderPath: string = 'system/uploads'

  constructor(
    private messageMediaService: MessageMediaService,
    private uploadConfig: UploadConfig
  ) {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
      },
    })
    this.symmetricFileEncryptor = new SymmetricFileEncryptor()
    this.symmetricTextEncryptor = new SymmetricTextEncryptor()
  }

  private hashFileName(fileName: string, fileNameLength: number = 16) {
    return crypto.createHash('sha256').update(fileName).digest('hex').slice(0, fileNameLength)
  }

  createS3FileKey(originalFileName: string): string {
    return `${this.uploadFolderPath}/${Date.now()}-${this.hashFileName(originalFileName)}`
  }

  extractObjectKeyFromUrl(url: string) {
    return url.split('.amazonaws.com/')[1]
  }

  getS3Client(): S3Client {
    return this.s3Client
  }

  getS3BucketName(): string {
    return process.env.AWS_S3_BUCKET
  }

  getS3Region(): string {
    return process.env.AWS_REGION
  }

  createS3FileURL(fileKey: string): string {
    return `https://${this.getS3BucketName()}.s3.${this.getS3Region()}.amazonaws.com/${fileKey}`
  }

  async deleteFileByKey(fileKey: string): Promise<DeleteObjectCommandOutput> {
    return await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.getS3BucketName(),
        Key: fileKey,
      })
    )
  }

  async deleteFileByURL(fileUrl: string): Promise<DeleteObjectCommandOutput> {
    const objectKey = fileUrl.split('.amazonaws.com/')[1]
    if (!objectKey) {
      throw new Error('Invalid file URL!')
    }
    return await this.deleteFileByKey(objectKey)
  }

  createUploadStream(
    fileKey: string,
    passThroughStream: stream.PassThrough,
    fileMetadata: TFileMetadata,
    abortController: AbortController
  ): Upload {
    return new Upload({
      client: this.getS3Client(),
      params: {
        Bucket: this.getS3BucketName(),
        Key: fileKey,
        Body: passThroughStream,
        ContentType: 'application/octet-stream',
        Metadata: fileMetadata,
      },
      abortController: abortController,
    })
  }

  async saveFile(
    fileKey: string,
    fileBuffer: Buffer,
    fileMimeType: string
  ): Promise<PutObjectCommandOutput> {
    return await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.getS3BucketName(),
        Key: fileKey,
        Body: fileBuffer,
        ContentType: fileMimeType,
        Metadata: typeToObject<TFileMetadata>({
          encrypted: 'true',
        }),
      })
    )
  }

  async fetchFileMetadata(fileKey: string): Promise<TFileMetadata | null> {
    const headResponse = await this.s3Client.send(
      new HeadObjectCommand({
        Bucket: this.getS3BucketName(),
        Key: fileKey,
      })
    )
    return headResponse.Metadata as TFileMetadata
  }

  getContentTypeHeaderByFileExtension(fileExt: string): string | undefined {
    return this.uploadConfig.getFileExtToMimeTypeMappings()[fileExt]
  }

  private getMimeTypeFromFilePath = (filePath: string): string => {
    return mime.lookup(filePath) || 'application/octet-stream'
  }

  private checkNeedRangeSupport = (filePath: string): boolean => {
    const mimeType = this.getMimeTypeFromFilePath(filePath)
    return mimeType.startsWith('video/') || mimeType.startsWith('audio/')
  }

  private setResponseHeadersForGetFile(
    reqHeaders: IncomingHttpHeaders,
    res: Response,
    msgMedia: TMessageMedia
  ): void {
    // Set headers
    res.setHeader(
      'Content-Type',
      this.getContentTypeHeaderByFileExtension(msgMedia.fileType) || 'application/octet-stream'
    )
    res.setHeader('Content-Disposition', 'inline') // Hiển thị trên browser thay vì download
    res.setHeader('Accept-Ranges', 'bytes')
    const range = reqHeaders.range
    if (range && this.checkNeedRangeSupport(msgMedia.fileName)) {
      const { fileSize } = msgMedia
      // Parse range header: "bytes=start-end"
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = end - start + 1

      // Validate range
      if (start >= fileSize || end >= fileSize) {
        res
          .status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
          .setHeader('Content-Range', `bytes */${fileSize}`)
        res.end()
        return
      }

      // Set headers cho partial content
      res.status(HttpStatus.PARTIAL_CONTENT) // Partial Content
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`)
      res.setHeader('Content-Length', chunkSize)
    }
  }

  createMessageMediaUrl(s3MediaFileKey: string, needToEncodeFileKey?: boolean): string {
    return `${process.env.NODE_ENV === 'development' ? process.env.SERVER_ENDPOINT_DEV : process.env.SERVER_ENDPOINT}/${ERoutes.UPLOAD}/file?fkey=${needToEncodeFileKey ? encodeURIComponent(s3MediaFileKey) : s3MediaFileKey}`
  }

  async getFileFromURL(
    fileKey: string,
    reqHeaders: IncomingHttpHeaders,
    res: Response
  ): Promise<void> {
    const msgMedia = await this.messageMediaService.findMessageMediaByURL(
      this.createMessageMediaUrl(fileKey)
    )
    if (!msgMedia) {
      throw new NotFoundException('MessageMedia not found')
    }
    let s3Stream: NodeJS.ReadableStream
    let metadata: TFileMetadata
    try {
      // Lấy object stream từ S3
      const s3Response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.getS3BucketName(),
          Key: fileKey,
        })
      )
      s3Stream = s3Response.Body as NodeJS.ReadableStream
      metadata = s3Response.Metadata as TFileMetadata
    } catch (error) {
      console.error('>>> S3 fetch file error:', error)
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Get file from S3 failed')
      return
    }
    // Ensure s3Stream is a Node.js Readable stream
    if (!s3Stream || typeof (s3Stream as any).pipe !== 'function') {
      throw new InternalServerErrorException('S3 response body is not a readable stream')
    }

    // Tạo decipher stream
    const decipher = this.symmetricFileEncryptor.createStreamDecryptor(
      Buffer.from(
        this.symmetricTextEncryptor.decrypt(
          msgMedia.dek,
          process.env.MESSAGES_ENCRYPTION_SECRET_KEY
        ),
        'base64'
      ), // 32 bytes
      Buffer.from(msgMedia.iv, 'base64') // 16 bytes
    )
    decipher.setAuthTag(Buffer.from(msgMedia.authTag, 'base64'))

    this.setResponseHeadersForGetFile(reqHeaders, res, msgMedia)

    // Pipeline: S3 Stream -> Decipher -> Response
    stream.pipeline(s3Stream as NodeJS.ReadableStream, decipher, res, (error) => {
      if (error) {
        console.error('>>> stream pipeline error:', error)
        if (!res.headersSent) {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Decryption failed')
        }
      }
    })
  }
}
