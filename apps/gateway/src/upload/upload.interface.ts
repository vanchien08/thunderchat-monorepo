import type { TUploadResult } from './upload.type'
import type { Express } from 'express'

export interface IUploadController {
  uploadFile: (file: Express.Multer.File) => Promise<TUploadResult>
}
