import { Module } from '@nestjs/common'
import { UploadService } from './upload.service'
import { UploadController } from './upload.controller'
import { ThumbnailService } from './thumbnail.service'
import { S3FileService } from './s3-file.service'
import { MessageMediaService } from './message-media.service'
import { UploadConfig } from './upload.config'
import { UploadGrpcController } from './upload-grpc.controller'

@Module({
  controllers: [UploadController, UploadGrpcController],
  providers: [UploadService, ThumbnailService, S3FileService, MessageMediaService, UploadConfig],
})
export class UploadModule {}
