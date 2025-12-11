import type { CompleteMultipartUploadCommandOutput } from '@aws-sdk/client-s3'

export type TUploadResult = {
  id: number
  url: string
  fileType: string
  fileName: string
  thumbnailUrl?: string
  fileSize: string
}

export type TFileMetadata = {
  encrypted: string
}

export type TUploadedPromise = {
  id: number
  promise: Promise<CompleteMultipartUploadCommandOutput>
  filename: string
  fileType: string
  fileSize: number
  iv: string
  dek: string
  authTag: string
  fileKey: string
}

export type TUploadMultipleFilesResult = {
  success: boolean
  message: string
  uploadedFiles: (
    | {
        id: number
        fileType: string
        filename: string
        location: string | undefined
        key: string | undefined
        iv: string
      }
    | {
        error: string
      }
  )[]
}

export type TUploadReportImageRes = {
  url: string
}

export type TUploadReportMessageMedia = TUploadReportImageRes

export type TUploadReportMessageFromUrl = TUploadReportImageRes

export type TUploadGroupChatAvatar = TUploadReportImageRes
