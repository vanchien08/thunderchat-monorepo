import type { TUploadResult } from '@/upload/upload.type'
import type { UploadService as UploadServiceType } from 'protos/generated/media'
import { firstValueFrom } from 'rxjs'

export class UploadService {
  constructor(private instance: UploadServiceType) {}

  async deleteFileByUrl(fileUrl: string): Promise<void> {
    await this.instance.DeleteFileByUrl({ url: fileUrl })
  }

  async uploadFile(file: Express.Multer.File): Promise<TUploadResult> {
    const response = await firstValueFrom(
      this.instance.UploadFile({
        content: file.buffer,
        filename: file.originalname,
      })
    )
    return JSON.parse(response.fileInfoJson) as TUploadResult
  }
}
