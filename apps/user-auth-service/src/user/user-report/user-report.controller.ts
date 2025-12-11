import { Body, Controller, Post, UseInterceptors, UploadedFiles, UseFilters } from '@nestjs/common'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { CreateViolationReportDTO } from './user-report.dto'
import { UserReportService } from './user-report.service'
import { User } from '@/user/user.decorator'
import { EUserReportMessages } from './user-report.message'
import { UserReportExceptionFilter } from './user-report.exception-filter'
import { TUserWithProfile } from '@/utils/entities/user.entity'
import type { Express } from 'express'

@Controller('user-report')
@UseFilters(UserReportExceptionFilter)
export class UserReportController {
  constructor(private userReportService: UserReportService) {}

  @Post('create-violation-report')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'reportImages', maxCount: 10 }, // Set higher limit, validate in controller
    ])
  )
  async createViolationReport(
    @User() user: TUserWithProfile,
    @Body() createViolationReportData: CreateViolationReportDTO,
    @UploadedFiles() files?: { reportImages?: Express.Multer.File[] }
  ) {
    const reportImages = files?.reportImages || []

    // Parse reportedMessages from FormData array format
    if (
      createViolationReportData.reportedMessages &&
      typeof createViolationReportData.reportedMessages === 'object'
    ) {
      // FormData đã tự động parse thành object, không cần làm gì thêm
    } else if (typeof createViolationReportData.reportedMessages === 'string') {
      try {
        createViolationReportData.reportedMessages = JSON.parse(
          createViolationReportData.reportedMessages
        )
      } catch (error) {
        return {
          success: false,
          error: 'Invalid reportedMessages format',
          code: 'INVALID_MESSAGES_FORMAT',
          details: { error: error.message },
        }
      }
    }

    // Validate maximum number of report images
    if (reportImages.length > 5) {
      return {
        success: false,
        error: EUserReportMessages.MAX_REPORT_IMAGES_ALLOWED,
        code: 'MAX_IMAGES_EXCEEDED',
        details: {
          currentCount: reportImages.length,
          maxAllowed: 5,
        },
      }
    }

    // Validate file types for report images
    if (reportImages.length > 0) {
      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/svg+xml',
        'image/tiff',
        'image/heic',
      ]
      for (const image of reportImages) {
        if (!allowedMimeTypes.includes(image.mimetype)) {
          return {
            success: false,
            error: EUserReportMessages.INVALID_FILE_TYPE,
            code: 'INVALID_FILE_TYPE',
            details: { fileName: image.originalname, mimeType: image.mimetype },
          }
        }
        // Check file size (max 10MB per image)
        if (image.size > 10 * 1024 * 1024) {
          return {
            success: false,
            error: EUserReportMessages.FILE_TOO_LARGE,
            code: 'FILE_TOO_LARGE',
            details: { fileName: image.originalname, size: image.size, maxSize: 10 * 1024 * 1024 },
          }
        }
      }
    }

    return await this.userReportService.createViolationReport(
      user.id,
      createViolationReportData,
      reportImages
    )
  }
}
