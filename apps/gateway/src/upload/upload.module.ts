import { Module } from '@nestjs/common'
import { UploadService } from './upload.service'
import { UploadController } from './upload.controller'
import { ThumbnailService } from './thumbnail.service'
import { S3UploadService } from './s3-upload.service'
import { FileService } from './file.service'

@Module({
  controllers: [UploadController],
  providers: [UploadService, ThumbnailService, S3UploadService, FileService],
  exports: [UploadService, ThumbnailService, S3UploadService, FileService],
})
export class UploadModule {}
