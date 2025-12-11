import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UploadService } from './upload.service'
import { Express } from 'express'
import type { IUploadController } from './upload.interface'
import { ERoutes } from '@/utils/enums'
import type { Request, Response } from 'express'
import { S3FileService } from './s3-file.service'
import { GetFileDTO } from './upload.dto'

@Controller(ERoutes.UPLOAD)
export class UploadController implements IUploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly s3FileService: S3FileService
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return await this.uploadService.uploadFileNonEncrypted(file)
  }

  @Post('/multiple-files')
  async uploadMultipleFiles(@Req() req: Request, @Res() res: Response) {
    await this.uploadService.uploadMultipleFiles(req, res)
  }

  @Get('/file')
  async getFile(@Query() params: GetFileDTO, @Req() req: Request, @Res() res: Response) {
    await this.s3FileService.getFileFromURL(params.fkey, req.headers, res)
  }

  @Get()
  async getHello() {
    return 'Hello from Media Service: ' + process.env.PORT
  }

  @Get('/reply')
  async getReply() {
    return 'Reply from Media Service: ' + process.env.PORT
  }
}
