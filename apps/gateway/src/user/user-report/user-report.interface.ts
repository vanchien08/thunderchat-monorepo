import { CreateViolationReportDTO } from './user-report.dto'
import type { Express } from 'express'

export interface IUserReportService {
  createViolationReport(
    reporterUserId: number,
    createViolationReportData: CreateViolationReportDTO,
    reportImages?: Express.Multer.File[]
  ): Promise<{
    success: boolean
    reportId?: number
    message?: string
    error?: string
    code?: string
    details?: unknown
  }>
}
