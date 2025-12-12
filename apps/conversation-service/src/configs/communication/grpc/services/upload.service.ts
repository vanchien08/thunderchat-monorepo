import type { TUploadResult } from '@/upload/upload.type'
import type { UploadService as UploadServiceType } from 'protos/generated/media'
import { firstValueFrom } from 'rxjs'

export class UploadService {
  constructor(private instance: UploadServiceType) {}

  async deleteFileByUrl(fileUrl: string): Promise<void> {
    await firstValueFrom(this.instance.DeleteFileByUrl({ url: fileUrl }))
  }

  async uploadFile(file: Express.Multer.File): Promise<TUploadResult> {
    return JSON.parse(
      (
        await firstValueFrom(
          this.instance.UploadFile({
            content: file.buffer,
            filename: file.originalname,
          })
        )
      ).fileInfoJson
    ) as TUploadResult
  }

  async uploadGroupChatAvatar(file: Express.Multer.File): Promise<{ url: string }> {
    return await firstValueFrom(
      this.instance.UploadGroupChatAvatar({
        file: file.buffer,
        filename: file.originalname,
      })
    )
  }

  async deleteGroupChatAvatar(avatarUrl: string): Promise<void> {
    await firstValueFrom(this.instance.DeleteGroupChatAvatar({ avatarUrl }))
  }
}
