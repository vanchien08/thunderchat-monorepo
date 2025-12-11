import {
  DeleteFileByUrlRequest,
  DeleteGroupChatAvatarRequest,
  UploadFileRequest,
  UploadFileResponse,
  UploadGroupChatAvatarRequest,
  UploadGroupChatAvatarResponse,
  UploadReportImageRequest,
  UploadReportImageResponse,
  UploadReportMessageMediaRequest,
  UploadReportMessageMediaResponse,
} from 'protos/generated/media'
import type { TUploadResult } from './upload.type'
import type { Express, Request, Response } from 'express'

export interface IUploadController {
  uploadFile: (file: Express.Multer.File) => Promise<TUploadResult>
  getHello: () => Promise<string>
  uploadMultipleFiles: (req: Request, res: Response) => Promise<void>
}

export interface IUploadGrpcController {
  DeleteFileByUrl(data: DeleteFileByUrlRequest): Promise<void>
  UploadFile(data: UploadFileRequest): Promise<UploadFileResponse>
  UploadGroupChatAvatar(data: UploadGroupChatAvatarRequest): Promise<UploadGroupChatAvatarResponse>
  DeleteGroupChatAvatar(data: DeleteGroupChatAvatarRequest): Promise<void>
  UploadReportImage(data: UploadReportImageRequest): Promise<UploadReportImageResponse>
  UploadReportMessageMedia(
    data: UploadReportMessageMediaRequest
  ): Promise<UploadReportMessageMediaResponse>
}
