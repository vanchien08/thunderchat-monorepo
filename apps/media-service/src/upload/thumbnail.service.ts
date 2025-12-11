import { Injectable } from '@nestjs/common'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { DevLogger } from '@/dev/dev-logger'
import { S3FileService } from './s3-file.service'

@Injectable()
export class ThumbnailService {
  constructor(private s3FileService: S3FileService) {}

  /**
   * Tạo thumbnail cho video và upload lên S3
   */
  async generateVideoThumbnail(videoUrl: string, videoKey: string): Promise<string> {
    const thumbnailKey = this.generateThumbnailKey(videoKey)
    const tempVideoPath = path.join(os.tmpdir(), `temp_video_${Date.now()}.mp4`)
    const tempThumbnailPath = path.join(os.tmpdir(), `thumbnail_${Date.now()}.jpg`)
    let thumbnailUploaded = false

    try {
      // Bước 1: Download video từ S3 về temp
      await this.downloadVideoFromS3(videoUrl, tempVideoPath)

      // Bước 2: Tạo thumbnail bằng ffmpeg
      await this.createThumbnailWithFfmpeg(tempVideoPath, tempThumbnailPath)

      // Bước 3: Upload thumbnail lên S3
      const thumbnailUrl = await this.uploadThumbnailToS3(tempThumbnailPath, thumbnailKey)
      thumbnailUploaded = true

      // Bước 4: Cleanup temp files
      this.cleanupTempFiles([tempVideoPath, tempThumbnailPath])

      return thumbnailUrl
    } catch (error) {
      DevLogger.logError('generate Video Thumbnail error:', error)

      if (thumbnailUploaded) {
        await this.rollbackThumbnailUpload(thumbnailKey)
      }
      this.cleanupTempFiles([tempVideoPath, tempThumbnailPath])
      throw error
    }
  }

  private async downloadVideoFromS3(videoUrl: string, localPath: string): Promise<void> {
    try {
      const response = await fetch(videoUrl)
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`)
      }
      const buffer = await response.arrayBuffer()
      fs.writeFileSync(localPath, Buffer.from(buffer))
    } catch (error) {
      DevLogger.logError('download Video error:', error)
      throw error
    }
  }

  private async createThumbnailWithFfmpeg(videoPath: string, thumbnailPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg.setFfmpegPath(ffmpegInstaller.path)

      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['00:00:01'],
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath),
          size: '320x?',
        })
        .on('end', () => {
          resolve()
        })
        .on('error', (error) => {
          DevLogger.logError('create Thumbnail error:', error)
          reject(error)
        })
    })
  }

  private async uploadThumbnailToS3(thumbnailPath: string, thumbnailKey: string): Promise<string> {
    try {
      const fileBuffer = fs.readFileSync(thumbnailPath)

      await this.s3FileService.saveFile(`thumbnail/${thumbnailKey}`, fileBuffer, 'image/jpeg')

      const location = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/thumbnail/${thumbnailKey}`
      return location
    } catch (error) {
      DevLogger.logError('upload Thumbnail error:', error)
      throw error
    }
  }

  private generateThumbnailKey(videoKey: string): string {
    const videoName = path.basename(videoKey, path.extname(videoKey))
    return `${videoName}_thumb.jpg`
  }

  private cleanupTempFiles(filePaths: string[]): void {
    filePaths.forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } catch (error) {
        DevLogger.logError('cleanup Temp Files error:', error)
      }
    })
  }

  private async rollbackThumbnailUpload(thumbnailKey: string): Promise<void> {
    try {
      await this.s3FileService.deleteFileByKey(`thumbnail/${thumbnailKey}`)
    } catch (error) {
      DevLogger.logError('rollback Thumbnail Upload error:', error)
      throw error
    }
  }

  async checkThumbnailExists(videoKey: string): Promise<string | null> {
    try {
      const thumbnailKey = this.generateThumbnailKey(videoKey)
      await this.s3FileService.fetchFileMetadata(`thumbnail/${thumbnailKey}`)
      return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/thumbnail/${thumbnailKey}`
    } catch {
      return null
    }
  }
}
