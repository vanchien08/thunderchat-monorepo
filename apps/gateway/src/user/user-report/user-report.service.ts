import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../../configs/db/prisma.service'
import { EProviderTokens } from '@/utils/enums'
import { UploadService } from '../../upload/upload.service'
import { CreateViolationReportDTO, ReportedMessageDTO } from './user-report.dto'
import { MessageType, ReportCategory } from '@prisma/client'
import { DevLogger } from '@/dev/dev-logger'
import { EUserReportMessages } from './user-report.message'
import { IUserReportService } from './user-report.interface'
import { EReportedMessageTypes } from './user-report.enum'
import type { Express } from 'express'

@Injectable()
export class UserReportService implements IUserReportService {
  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private prismaService: PrismaService,
    private uploadService: UploadService
  ) {}

  async createViolationReport(
    reporterUserId: number,
    createViolationReportData: CreateViolationReportDTO,
    reportImages?: Express.Multer.File[]
  ) {
    const { reportedUserId, reportCategory, reasonText, reportedMessages } =
      createViolationReportData

    // Track uploaded files outside transaction for rollback
    let uploadedMediaUrls: string[] = []
    let uploadedImageUrls: string[] = []

    // Check if reported user exists
    const reportedUser = await this.prismaService.user.findUnique({
      where: { id: reportedUserId },
    })
    if (!reportedUser) {
      return {
        success: false,
        error: EUserReportMessages.REPORTED_USER_NOT_FOUND,
        code: 'USER_NOT_FOUND',
        details: { reportedUserId },
      }
    }

    // Check if reporter is not reporting themselves
    if (reporterUserId === reportedUserId) {
      return {
        success: false,
        error: EUserReportMessages.CANNOT_REPORT_SELF,
        code: 'SELF_REPORT_NOT_ALLOWED',
      }
    }

    // Check if user has already reported this person recently (within 24 hours)
    const existingReport = await this.prismaService.violationReport.findFirst({
      where: {
        reporterUserId,
        reportedUserId,
        createdAt: {
          gte: new Date(Date.now() - 10 * 1000),
          // gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
        },
      },
    })
    if (existingReport) {
      return {
        success: false,
        error: EUserReportMessages.DUPLICATE_REPORT,
        code: 'DUPLICATE_REPORT',
        details: { existingReportId: existingReport.id, createdAt: existingReport.createdAt },
      }
    }

    // Use transaction to ensure data consistency
    try {
      return await this.prismaService.$transaction(async (prisma) => {
        // 1. Create the main violation report
        const violationReport = await prisma.violationReport.create({
          data: {
            reporterUserId,
            reportedUserId,
            reportCategory,
            reasonText,
          },
        })

        // 2. Handle report images if any
        if (reportImages && reportImages.length > 0) {
          for (const image of reportImages) {
            try {
              // Upload to AWS S3 using the service method
              // const { url: imageUrl } = await this.uploadService.uploadReportImage(image)
              // uploadedImageUrls.push(imageUrl)
              // // Save to database
              // await prisma.reportImage.create({
              //   data: {
              //     reportId: violationReport.id,
              //     imageUrl,
              //   },
              // })
            } catch (error) {
              DevLogger.logError(`Failed to upload report image:`, error)
              // Rollback uploaded images
              for (const uploadedUrl of uploadedImageUrls) {
                await this.uploadService.deleteFileByUrl(uploadedUrl)
              }
              throw new Error(`${EUserReportMessages.UPLOAD_FAILED}: ${error.message}`)
            }
          }
        }

        // 3. Handle reported messages if any
        if (reportedMessages && reportedMessages.length > 0) {
          const failedUploads: { messageId: number; error: string }[] = []

          // Process messages sequentially to avoid concurrent upload issues
          for (const messageData of reportedMessages) {
            const { messageId, messageType, messageContent } = messageData

            // Check if message exists and belongs to the reported user
            const message = await prisma.message.findFirst({
              where: {
                id: messageId,
                OR: [{ authorId: reportedUserId }, { recipientId: reportedUserId }],
              },
            })
            if (!message) {
              throw new Error(
                `${EUserReportMessages.MESSAGE_NOT_FOUND} with ID ${messageId} or message does not belong to reported user`
              )
            }

            let finalMessageContent = messageContent || ''

            // Handle media types that need AWS upload
            if (this.isMediaMessageType(messageType)) {
              // Check if content is already a URL (AWS S3, HTTP, etc.)
              if (messageContent && this.isUrl(messageContent)) {
                // Content is a URL, download and upload to AWS S3
                try {
                  // Add delay between uploads to avoid rate limiting
                  if (uploadedMediaUrls.length > 0) {
                    await new Promise((resolve) => setTimeout(resolve, 500)) // Reduced delay to 500ms
                  }

                  // // Add timeout for upload operation
                  // const uploadPromise = this.uploadService.uploadReportMessageFromUrl(
                  //   messageContent,
                  //   messageId,
                  //   this.getContentTypeForMessageType(messageType)
                  // )

                  const url = messageContent

                  // Check if URL was returned from AWS
                  if (!url || url.trim() === '') {
                    throw new Error(`AWS upload failed: No URL returned for message ${messageId}`)
                  }

                  finalMessageContent = url
                  uploadedMediaUrls.push(url)
                } catch (error) {
                  DevLogger.logError(
                    `Failed to download and upload reported message media ${messageId} from URL:`,
                    error
                  )
                  failedUploads.push({ messageId, error: error.message })

                  // Rollback all uploaded files and throw error to rollback transaction
                  await this.rollbackUploadedFiles(uploadedMediaUrls)
                  throw new Error(`Media upload failed for message ${messageId}: ${error.message}`)
                }
              } else if (messageContent) {
                // Content is a file path, need to upload to AWS
                if (!messageContent.startsWith('/') && !messageContent.includes('\\')) {
                  throw new Error(
                    `Media message (${messageType}) requires a valid file path for AWS upload`
                  )
                }

                // Check if file exists
                const fs = require('fs')
                if (!fs.existsSync(messageContent)) {
                  throw new Error(`${EUserReportMessages.FILE_NOT_FOUND}: ${messageContent}`)
                }

                try {
                  // Add delay between uploads to avoid rate limiting
                  if (uploadedMediaUrls.length > 0) {
                    await new Promise((resolve) => setTimeout(resolve, 500)) // Reduced delay to 500ms
                  }

                  // Add timeout for upload operation
                  const uploadPromise = this.uploadService.uploadReportMessageMedia(
                    messageContent,
                    messageId,
                    this.getContentTypeForMessageType(messageType)
                  )

                  const result = await Promise.race([
                    uploadPromise,
                    new Promise<never>(
                      (_, reject) =>
                        setTimeout(
                          () => reject(new Error(`Upload timeout for message ${messageId}`)),
                          60000
                        ) // 60 seconds timeout
                    ),
                  ])

                  const { url } = result

                  // Check if URL was returned from AWS
                  if (!url || url.trim() === '') {
                    throw new Error(`AWS upload failed: No URL returned for message ${messageId}`)
                  }

                  finalMessageContent = url
                  uploadedMediaUrls.push(url)
                } catch (error) {
                  DevLogger.logError('Failed to upload reported message media:', error)
                  failedUploads.push({ messageId, error: error.message })

                  // Rollback all uploaded files and throw error to rollback transaction
                  await this.rollbackUploadedFiles(uploadedMediaUrls)
                  throw new Error(`Media upload failed for message ${messageId}: ${error.message}`)
                }
              } else {
                // No content provided for media message - this is NOT normal for media messages
                throw new Error(
                  `Media message ${messageId} (${messageType}) requires content but none was provided`
                )
              }
            }

            // Save to database (even if upload failed, we still save the record)
            await prisma.reportedMessage.create({
              data: {
                messageId,
                messageType,
                messageContent: finalMessageContent,
                reportId: violationReport.id,
              },
            })
          }
        }

        return {
          success: true,
          reportId: violationReport.id,
          message: EUserReportMessages.REPORT_CREATED_SUCCESS,
        }
      })
    } catch (error) {
      DevLogger.logError('Transaction failed:', error)

      // If transaction failed and we have uploaded files, rollback them
      if (uploadedMediaUrls.length > 0 || uploadedImageUrls.length > 0) {
        DevLogger.logError(
          `Transaction failed, rolling back ${uploadedMediaUrls.length} media files and ${uploadedImageUrls.length} image files`
        )

        // Rollback all uploaded files
        const allUploadedUrls = [...uploadedMediaUrls, ...uploadedImageUrls]
        await this.rollbackUploadedFiles(allUploadedUrls)
      }

      // Parse error message to determine the specific error type
      const errorMessage = error.message

      if (errorMessage.includes('MESSAGE_NOT_FOUND')) {
        return {
          success: false,
          error: errorMessage,
          code: 'MESSAGE_NOT_FOUND',
          details: { originalError: error.message },
        }
      } else if (errorMessage.includes('INVALID_FILE_PATH')) {
        return {
          success: false,
          error: errorMessage,
          code: 'INVALID_FILE_PATH',
          details: { originalError: error.message },
        }
      } else if (errorMessage.includes('FILE_NOT_FOUND')) {
        return {
          success: false,
          error: errorMessage,
          code: 'FILE_NOT_FOUND',
          details: { originalError: error.message },
        }
      } else if (errorMessage.includes('UPLOAD_FAILED')) {
        return {
          success: false,
          error: errorMessage,
          code: 'UPLOAD_FAILED',
          details: { originalError: error.message },
        }
      } else {
        return {
          success: false,
          error: EUserReportMessages.TRANSACTION_FAILED,
          code: 'TRANSACTION_FAILED',
          details: { originalError: error.message },
        }
      }
    }
  }

  private isMediaMessageType(messageType: EReportedMessageTypes): boolean {
    return (
      messageType === EReportedMessageTypes.IMAGE ||
      messageType === EReportedMessageTypes.VIDEO ||
      messageType === EReportedMessageTypes.AUDIO ||
      messageType === EReportedMessageTypes.DOCUMENT
    )
  }

  private getContentTypeForMessageType(messageType: EReportedMessageTypes): string {
    switch (messageType) {
      case EReportedMessageTypes.IMAGE:
        return 'image/jpeg' // Default to JPEG, will be overridden by actual file extension
      case EReportedMessageTypes.VIDEO:
        return 'video/mp4' // Default to MP4, will be overridden by actual file extension
      case EReportedMessageTypes.AUDIO:
        return 'audio/mpeg' // Default to MP3, will be overridden by actual file extension
      case EReportedMessageTypes.DOCUMENT:
        return 'application/pdf' // Default to PDF, will be overridden by actual file extension
      default:
        return 'application/octet-stream'
    }
  }

  private isUrl(content: string): boolean {
    try {
      const url = new URL(content)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }

  /**
   * Rollback uploaded files with better error handling
   */
  private async rollbackUploadedFiles(uploadedUrls: string[]): Promise<void> {
    if (uploadedUrls.length === 0) return

    DevLogger.logError(`Rolling back ${uploadedUrls.length} uploaded files`)

    const rollbackPromises = uploadedUrls.map(async (url) => {
      try {
        await this.uploadService.deleteFileByUrl(url)
        DevLogger.logError(`Successfully rolled back: ${url}`)
      } catch (error) {
        DevLogger.logError(`Failed to rollback file ${url}:`, error)
        // Continue with other rollbacks even if one fails
      }
    })

    // Wait for all rollbacks to complete (with timeout)
    try {
      await Promise.race([
        Promise.all(rollbackPromises),
        new Promise(
          (_, reject) => setTimeout(() => reject(new Error('Rollback timeout')), 30000) // 30 seconds timeout for rollback
        ),
      ])
      DevLogger.logError(`Successfully completed rollback for ${uploadedUrls.length} files`)
    } catch (error) {
      DevLogger.logError('Rollback timeout or error:', error)
      // Even if timeout, continue with individual rollbacks
      for (const url of uploadedUrls) {
        try {
          await this.uploadService.deleteFileByUrl(url)
          DevLogger.logError(`Successfully rolled back after timeout: ${url}`)
        } catch (rollbackError) {
          DevLogger.logError(`Failed to rollback file after timeout ${url}:`, rollbackError)
        }
      }
    }
  }
}
