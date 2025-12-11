import { DevLogger } from '@/dev/dev-logger'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Injectable } from '@nestjs/common'
import { createReadStream } from 'fs'
import { FileService } from './file.service'
import type { Express } from 'express'

@Injectable()
export class S3UploadService {
  private readonly s3Client: S3Client
  private readonly groupChatAvatarFolder = 'system/group-chat'
  private readonly awsBucketName = process.env.AWS_BUCKET_NAME

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  }

  extractObjectKeyFromUrl(url: string) {
    return url.split('.amazonaws.com/')[1]
  }

  async uploadGroupChatAvatar(file: Express.Multer.File): Promise<{ url: string }> {
    const fileStream = createReadStream(file.path)
    const uploadKey = `${this.groupChatAvatarFolder}/${Date.now()}-${FileService.hashFileName(file.originalname)}`

    const command = new PutObjectCommand({
      Bucket: this.awsBucketName,
      Key: uploadKey,
      Body: fileStream,
      ContentType: file.mimetype,
    })

    const res = await this.s3Client.send(command)
    DevLogger.logInfo('uploaded:', res)

    return {
      url: `https://${this.awsBucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploadKey}`,
    }
  }

  async deleteGroupChatAvatar(avatarUrl: string): Promise<void> {
    const objectKey = this.extractObjectKeyFromUrl(avatarUrl)
    const command = new DeleteObjectCommand({
      Bucket: this.awsBucketName,
      Key: objectKey,
    })

    const res = await this.s3Client.send(command)
    DevLogger.logInfo('deleted:', res)
  }
}
