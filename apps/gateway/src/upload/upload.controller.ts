import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UploadService } from './upload.service'
import { Express } from 'express'
import type { IUploadController } from './upload.interface'

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}
}
