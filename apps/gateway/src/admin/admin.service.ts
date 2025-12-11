import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '@/configs/db/prisma.service'
import { UserService } from '@/user/user.service'
import { UserConnectionService } from '@/connection/user-connection.service'
import { UploadService } from '@/upload/upload.service'
import { EProviderTokens, EAppRoles } from '@/utils/enums'
import { EMessagingEmitSocketEvents } from '@/utils/events/socket.event'
import {
  TAdminUsersData,
  TGetAdminUsersParams,
  TUpdateUserEmailResponse,
  TViolationReportsData,
  TGetViolationReportsParams,
  TViolationReportDetail,
  TUpdateViolationReportStatusResponse,
  TBanUserResponse,
  TViolationReport,
  TGetUserReportHistoryParams,
  TUserReportHistoryData,
  TUserReportHistoryItem,
  TSystemOverviewData,
  TGetSystemOverviewParams,
  TUserMessageStats,
  TGetUserMessageStatsParams,
  TGetUserMessageStatsData,
  TViolationReportStatus,
  TViolationReportActionType,
} from './admin.type'
import { Prisma } from '@prisma/client'

@Injectable()
export class AdminService {
  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT)
    private prisma: PrismaService,
    private userService: UserService,
    private userConnectionService: UserConnectionService,
    private uploadService: UploadService
  ) {}

  async getUsers(params: TGetAdminUsersParams): Promise<TAdminUsersData> {
    const { page, limit, search, status } = params

    // Build where clause for filtering
    const where: Prisma.UserWhereInput = {
      role: EAppRoles.USER, // Only get users with role USER
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { Profile: { fullName: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Count total items for pagination
    const totalItems = await this.prisma.user.count({ where })

    // Calculate pagination
    const totalPages = Math.ceil(totalItems / limit)
    const skip = (page - 1) * limit

    // Get users with pagination
    const users = await this.prisma.user.findMany({
      where,
      skip,
      take: limit,
      include: {
        Profile: {
          select: {
            fullName: true,
            avatar: true,
            birthday: true,
            about: true,
          },
        },
        ReportsAbout: {
          include: {
            Actions: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Transform to admin user format
    let adminUsers = users.map((user) => {
      // Get the latest violation action for this user
      const latestViolationAction = user.ReportsAbout.flatMap((report) => report.Actions).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0]

      // Determine status based on latest violation action
      let status = 'NORMAL'
      if (latestViolationAction) {
        status = latestViolationAction.actionType
      }

      return {
        id: user.id,
        email: user.email,
        fullName: user.Profile?.fullName || 'Unknown',
        avatar: user.Profile?.avatar || undefined,
        birthday: user.Profile?.birthday?.toISOString() || null,
        about: user.Profile?.about || null,
        status,
        createdAt: user.createdAt.toISOString(),
      }
    })

    // Filter by status if specified
    if (status && status !== 'all') {
      adminUsers = adminUsers.filter((user) => user.status === status)
    }

    return {
      users: adminUsers,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    }
  }

  async lockUnlockUser(userId: number, isActive: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Always update both isActive and inActiveAt to current time
    const updateData = {
      isActive,
      inActiveAt: new Date(), // Always set to current time
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    return { success: true, message: 'User locked/unlocked successfully' }
  }

  async updateUserEmail(userId: number, newEmail: string): Promise<TUpdateUserEmailResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return {
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      }
    }

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: newEmail },
    })

    if (existingUser && existingUser.id !== userId) {
      return {
        success: false,
        message: 'Email already exists',
        error: 'EMAIL_ALREADY_EXISTS',
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { email: newEmail },
    })

    return { success: true, message: 'User email updated successfully' }
  }

  // Violation Reports Methods
  async getViolationReports(params: TGetViolationReportsParams): Promise<TViolationReportsData> {
    const { page, limit, search, status, category, startDate, endDate, sortBy, sortOrder } = params

    // Build where clause for filtering
    const where: Prisma.ViolationReportWhereInput = {}

    // Search filter
    if (search) {
      where.OR = [
        {
          ReporterUser: {
            Profile: {
              fullName: { contains: search, mode: 'insensitive' },
            },
          },
        },
        {
          ReporterUser: {
            email: { contains: search, mode: 'insensitive' },
          },
        },
        {
          ReportedUser: {
            Profile: {
              fullName: { contains: search, mode: 'insensitive' },
            },
          },
        },
        {
          ReportedUser: {
            email: { contains: search, mode: 'insensitive' },
          },
        },
        {
          reasonText: { contains: search, mode: 'insensitive' },
        },
      ]
    }

    // Status filter
    if (status && status !== 'ALL') {
      where.reportStatus = status
    }

    // Category filter
    if (category && category !== 'ALL') {
      where.reportCategory = category
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    // Count total items for pagination
    const totalItems = await this.prisma.violationReport.count({ where })

    // Calculate pagination
    const totalPages = Math.ceil(totalItems / limit)
    const skip = (page - 1) * limit

    // Get violation reports with pagination
    const reports = await this.prisma.violationReport.findMany({
      where,
      skip,
      take: limit,
      include: {
        ReporterUser: {
          include: {
            Profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
        ReportedUser: {
          include: {
            Profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
        ReportImages: {
          select: {
            id: true,
            imageUrl: true,
          },
        },
        ReportedMessages: {
          select: {
            id: true,
            messageId: true,
            messageType: true,
            messageContent: true,
          },
        },
      },
      orderBy: { [sortBy as string]: sortOrder },
    })

    // Transform to admin format
    const violationReports = reports.map((report) => ({
      id: report.id,
      reporterId: report.reporterUserId,
      reporterName: report.ReporterUser.Profile?.fullName || 'Unknown',
      reporterEmail: report.ReporterUser.email,
      reportedUserId: report.reportedUserId,
      reportedUserName: report.ReportedUser.Profile?.fullName || 'Unknown',
      reportedUserEmail: report.ReportedUser.email,
      reportCategory: report.reportCategory,
      reasonText: report.reasonText,
      status: report.reportStatus,
      evidenceCount: {
        images: report.ReportImages.length,
        messages: report.ReportedMessages.length,
      },
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.createdAt.toISOString(), // Using createdAt as updatedAt since there's no updatedAt field
    })) as TViolationReport[]

    // Get statistics
    const statistics = await this.getViolationReportsStatistics()

    return {
      reports: violationReports,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      statistics,
    }
  }

  async getViolationReportDetail(reportId: number): Promise<TViolationReportDetail | null> {
    try {
      const report = await this.prisma.violationReport.findUnique({
        where: { id: reportId },
        include: {
          ReporterUser: {
            include: {
              Profile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
          ReportedUser: {
            include: {
              Profile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
          ReportImages: {
            select: {
              id: true,
              imageUrl: true,
            },
          },
          ReportedMessages: {
            include: {
              ReportedMessage: {
                include: {
                  Author: {
                    include: {
                      Profile: true,
                    },
                  },
                },
              },
            },
          },
          Actions: {
            select: {
              id: true,
              actionType: true,
              actionReason: true,
              bannedUntil: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!report) {
        return null
      }

      // Lấy latest ban action của user bị báo cáo
      const latestBanAction = await this.prisma.violationAction.findFirst({
        where: {
          Report: { reportedUserId: report.reportedUserId },
          actionType: { in: ['TEMPORARY_BAN', 'PERMANENT_BAN'] },
        },
        orderBy: { createdAt: 'desc' },
      })

      return {
        id: report.id,
        reporterId: report.reporterUserId,
        reporterName: report.ReporterUser.Profile?.fullName || 'Unknown',
        reporterEmail: report.ReporterUser.email,
        reportedUserId: report.reportedUserId,
        reportedUserName: report.ReportedUser.Profile?.fullName || 'Unknown',
        reportedUserEmail: report.ReportedUser.email,
        reportCategory: report.reportCategory,
        reasonText: report.reasonText,
        status: report.reportStatus,
        evidenceCount: {
          images: report.ReportImages.length,
          messages: report.ReportedMessages.length,
        },
        reportImages: report.ReportImages.map((image) => ({
          id: image.id,
          imageUrl: image.imageUrl,
          createdAt: report.createdAt.toISOString(), // Using report createdAt since ReportImage doesn't have createdAt
        })),
        reportedMessages: report.ReportedMessages.map((message) => ({
          id: message.id,
          messageId: message.messageId,
          messageType: message.messageType,
          messageContent: message.messageContent,
          createdAt: message.createdAt.toISOString(), // Using actual message createdAt
          senderName: message.ReportedMessage?.Author?.Profile?.fullName || 'Unknown User',
          senderAvatar: message.ReportedMessage?.Author?.Profile?.avatar || '',
          senderId: message.ReportedMessage?.Author?.id || 0,
        })),
        violationAction:
          report.Actions.length > 0
            ? {
                id: report.Actions[0].id,
                actionType: report.Actions[0].actionType,
                actionReason: report.Actions[0].actionReason,
                bannedUntil: report.Actions[0].bannedUntil?.toISOString() || null,
                createdAt: report.Actions[0].createdAt.toISOString(),
              }
            : null,
        latestBanAction: latestBanAction
          ? {
              id: latestBanAction.id,
              actionType: latestBanAction.actionType,
              actionReason: latestBanAction.actionReason,
              bannedUntil: latestBanAction.bannedUntil?.toISOString() || null,
              createdAt: latestBanAction.createdAt.toISOString(),
            }
          : null,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.createdAt.toISOString(), // Using createdAt as updatedAt since there's no updatedAt field
      }
    } catch (error) {
      throw error
    }
  }

  async updateViolationReportStatus(
    reportId: number,
    status: TViolationReportStatus
  ): Promise<TUpdateViolationReportStatusResponse> {
    const report = await this.prisma.violationReport.findUnique({
      where: { id: reportId },
    })

    if (!report) {
      return {
        success: false,
        message: 'Violation report not found',
        error: 'REPORT_NOT_FOUND',
      }
    }

    // Check if report is already processed
    if (report.reportStatus !== 'PENDING') {
      return {
        success: false,
        message: `Cannot update status. Report is already ${report.reportStatus.toLowerCase()}`,
        error: 'REPORT_ALREADY_PROCESSED',
      }
    }

    await this.prisma.violationReport.update({
      where: { id: reportId },
      data: {
        reportStatus: status,
      },
    })

    return {
      success: true,
      message: `Violation report status updated to ${status}`,
    }
  }

  private converBanTypeToReadableMessage(banType: TViolationReportActionType): string {
    switch (banType) {
      case 'TEMPORARY_BAN':
        return 'Temporary ban'
      case 'PERMANENT_BAN':
        return 'Permanent ban'
      case 'WARNING':
        return 'Warning'
      default:
        return 'Unknown'
    }
  }

  async banReportedUser(
    reportId: number,
    banType: TViolationReportActionType,
    reason: string,
    banDuration?: number,
    bannedUntilIso?: string,
    messageIds?: number[]
  ): Promise<TBanUserResponse> {
    return await this.prisma.$transaction(async (tx) => {
      const report = await tx.violationReport.findUnique({
        where: { id: reportId },
        include: {
          ReportedUser: true,
        },
      })

      if (!report) {
        return {
          success: false,
          message: 'Violation report not found',
          error: 'REPORT_NOT_FOUND',
        }
      }

      const reportedUser = report.ReportedUser
      if (!reportedUser) {
        return {
          success: false,
          message: 'Reported user not found',
          error: 'USER_NOT_FOUND',
        }
      }

      // Check if report is already processed
      if (report.reportStatus !== 'PENDING') {
        return {
          success: false,
          message: `Cannot perform action. Report is already ${report.reportStatus.toLowerCase()}`,
          error: 'REPORT_ALREADY_PROCESSED',
        }
      }

      // Create violation action
      const actionData: Prisma.ViolationActionCreateInput = {
        Report: { connect: { id: reportId } },
        actionType: banType,
        actionReason: reason,
        // Note: adminId field doesn't exist in schema, would need to be added
      }

      if (banType === 'TEMPORARY_BAN') {
        if (bannedUntilIso) {
          const parsed = new Date(bannedUntilIso)
          if (isNaN(parsed.getTime())) {
            return {
              success: false,
              message: 'Invalid bannedUntil value',
              error: 'INVALID_BANNED_UNTIL',
            }
          }
          actionData.bannedUntil = parsed
        } else if (banDuration) {
          actionData.bannedUntil = new Date(Date.now() + banDuration * 24 * 60 * 60 * 1000)
        }
      }
      // For WARNING, no ban duration is set

      await tx.violationAction.create({
        data: actionData,
      })

      // Update report status
      await tx.violationReport.update({
        where: { id: reportId },
        data: {
          reportStatus: 'RESOLVED',
        },
      })

      // Update messages if messageIds provided
      if (messageIds && messageIds.length > 0) {
        // Get messages with their types and related data
        const messages = await tx.message.findMany({
          where: { id: { in: messageIds } },
          include: {
            Media: true,
          },
        })

        // Collect media IDs to delete and their URLs
        const mediaIdsToDelete: number[] = []
        const mediaUrlsToDelete: string[] = []

        // Process each message
        for (const message of messages) {
          const updateData: any = {
            isDeleted: true,
            isViolated: true,
            content: '', // Clear content
          }

          // Handle different message types
          if (message.type === 'STICKER') {
            updateData.stickerId = null // Remove sticker reference
          } else if (message.type === 'MEDIA' && message.mediaId && message.Media) {
            updateData.mediaId = null // Remove media reference
            mediaIdsToDelete.push(message.mediaId) // Mark media for deletion
            mediaUrlsToDelete.push(message.Media.url) // Collect URL for S3 deletion
          }

          // Update the message
          await tx.message.update({
            where: { id: message.id },
            data: updateData,
          })
        }

        // Delete related MessageMedia records if any
        if (mediaIdsToDelete.length > 0) {
          await tx.messageMedia.deleteMany({
            where: { id: { in: mediaIdsToDelete } },
          })
        }

        // Delete files from S3 (outside transaction to avoid timeout)
        if (mediaUrlsToDelete.length > 0) {
          // Use Promise.allSettled to handle potential failures gracefully
          await Promise.allSettled(
            mediaUrlsToDelete.map((url) => this.uploadService.deleteFileByUrl(url))
          )
        }

        // Emit socket events for deleted messages to update clients in real-time
        if (messageIds && messageIds.length > 0) {
          await this.emitDeletedMessagesUpdate(messageIds)
        }
      }

      const actionMessage =
        banType === 'WARNING'
          ? 'Warning issued successfully'
          : `User banned successfully with ${this.converBanTypeToReadableMessage(banType)}`

      return {
        success: true,
        message: actionMessage,
      }
    })
  }

  async getUserReportHistory(params: TGetUserReportHistoryParams): Promise<{
    success: boolean
    data?: TUserReportHistoryData
    message?: string
    error?: string
  }> {
    try {
      const { userId, type, page = 1, limit = 10 } = params
      const skip = (page - 1) * limit

      let reports: TUserReportHistoryItem[] = []
      let total = 0

      if (type === 'reported') {
        // Get reports MADE BY this user (user is reporter)
        const result = await this.prisma.violationReport.findMany({
          where: {
            reporterUserId: userId,
          },
          include: {
            ReportedUser: {
              include: {
                Profile: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        })

        total = await this.prisma.violationReport.count({
          where: {
            reporterUserId: userId,
          },
        })

        reports = result.map((report) => ({
          id: report.id,
          reportCategory: report.reportCategory,
          status: report.reportStatus,
          createdAt: report.createdAt.toISOString(),
          reasonText: report.reasonText,
          reportedUserName: report.ReportedUser.Profile?.fullName || report.ReportedUser.email,
          reportedUserEmail: report.ReportedUser.email,
        }))
      } else {
        // Get reports ABOUT this user (user is reported)
        const result = await this.prisma.violationReport.findMany({
          where: {
            reportedUserId: userId,
          },
          include: {
            ReporterUser: {
              include: {
                Profile: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        })

        total = await this.prisma.violationReport.count({
          where: {
            reportedUserId: userId,
          },
        })

        reports = result.map((report) => ({
          id: report.id,
          reportCategory: report.reportCategory,
          status: report.reportStatus,
          createdAt: report.createdAt.toISOString(),
          reasonText: report.reasonText,
          reporterName: report.ReporterUser.Profile?.fullName || report.ReporterUser.email,
          reporterEmail: report.ReporterUser.email,
        }))
      }

      const totalPages = Math.ceil(total / limit)

      return {
        success: true,
        data: {
          reports,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        },
      }
    } catch (error) {
      console.error('Error fetching user report history:', error)
      return {
        success: false,
        message: 'Failed to fetch user report history',
        error: 'FETCH_ERROR',
      }
    }
  }

  private async getViolationReportsStatistics() {
    const [total, pending, resolved, dismissed] = await Promise.all([
      this.prisma.violationReport.count(),
      this.prisma.violationReport.count({ where: { reportStatus: 'PENDING' } }),
      this.prisma.violationReport.count({ where: { reportStatus: 'RESOLVED' } }),
      this.prisma.violationReport.count({ where: { reportStatus: 'DISMISSED' } }),
    ])

    return {
      total,
      pending,
      resolved,
      dismissed,
    }
  }

  /**
   * Helper method to check if a violation report can be processed
   * @param reportId - The ID of the violation report
   * @returns Object with canProcess boolean and current status
   */
  async checkReportProcessability(reportId: number): Promise<{
    canProcess: boolean
    currentStatus: string | null
    message: string
  }> {
    const report = await this.prisma.violationReport.findUnique({
      where: { id: reportId },
      select: { reportStatus: true },
    })

    if (!report) {
      return {
        canProcess: false,
        currentStatus: null,
        message: 'Violation report not found',
      }
    }

    if (report.reportStatus !== 'PENDING') {
      return {
        canProcess: false,
        currentStatus: report.reportStatus,
        message: `Report is already ${report.reportStatus.toLowerCase()}`,
      }
    }

    return {
      canProcess: true,
      currentStatus: report.reportStatus,
      message: 'Report can be processed',
    }
  }

  async getSystemOverview(params: TGetSystemOverviewParams): Promise<TSystemOverviewData> {
    const { timeRange = 'month', startDate, endDate } = params

    // Calculate date range
    const now = new Date()
    let periodStart: Date
    let periodEnd: Date = now

    if (startDate && endDate) {
      periodStart = new Date(startDate)
      periodEnd = new Date(endDate)
    } else {
      switch (timeRange) {
        case 'day':
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'year':
          periodStart = new Date(now.getFullYear(), 0, 1)
          break
        default:
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      }
    }

    // Get total users
    const totalUsers = await this.prisma.user.count({
      where: { role: EAppRoles.USER },
    })

    // Get active users (currently connected users)
    const activeUsers = this.userConnectionService.getConnectedClientsCountForAdmin()

    // Get total direct messages (excluding PIN_NOTICE)
    const totalDirectMessages = await this.prisma.message.count({
      where: {
        directChatId: { not: null },
        type: { not: 'PIN_NOTICE' },
      },
    })

    // Get total group messages (excluding PIN_NOTICE)
    const totalGroupMessages = await this.prisma.message.count({
      where: {
        groupChatId: { not: null },
        type: { not: 'PIN_NOTICE' },
      },
    })

    // Get total messages (sum of direct and group messages)
    const totalMessages = totalDirectMessages + totalGroupMessages

    // Get active group chats (all group chats)
    const activeGroupChats = await this.prisma.groupChat.count()

    // Get violation reports statistics
    const totalViolationReports = await this.prisma.violationReport.count()

    const resolvedViolationReports = await this.prisma.violationReport.count({
      where: {
        reportStatus: 'RESOLVED',
      },
    })

    const pendingViolationReports = await this.prisma.violationReport.count({
      where: {
        reportStatus: 'PENDING',
      },
    })

    const dismissedViolationReports = await this.prisma.violationReport.count({
      where: {
        reportStatus: 'DISMISSED',
      },
    })

    // Generate chart data for the specified time range
    const chartData = await this.generateChartData(periodStart, periodEnd)

    // Determine the actual period based on provided parameters
    let actualPeriod: 'day' | 'week' | 'month' | 'year' | 'custom' = timeRange
    if (startDate && endDate) {
      actualPeriod = 'custom'
    }

    return {
      activeUsers,
      totalMessages,
      totalDirectMessages,
      totalGroupMessages,
      activeGroupChats,
      totalUsers,
      totalViolationReports,
      resolvedViolationReports,
      pendingViolationReports,
      dismissedViolationReports,
      timeRange: {
        startDate: periodStart.toISOString(),
        endDate: periodEnd.toISOString(),
        period: actualPeriod,
      },
      charts: chartData,
    }
  }

  async getUserMessageStats(params: TGetUserMessageStatsParams): Promise<TGetUserMessageStatsData> {
    const { page, limit, search, sortBy = 'totalMessageCount', sortOrder = 'desc' } = params

    // Build where clause for filtering users
    const where: Prisma.UserWhereInput = {
      role: EAppRoles.USER, // Only get users with role USER
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { Profile: { fullName: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Count total users for pagination
    const totalItems = await this.prisma.user.count({ where })

    // Calculate pagination
    const totalPages = Math.ceil(totalItems / limit)
    const skip = (page - 1) * limit

    // Get users with pagination
    const users = await this.prisma.user.findMany({
      where,
      skip,
      take: limit,
      include: {
        Profile: {
          select: {
            fullName: true,
            avatar: true,
          },
        },
        Messages: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Transform to user message stats format
    const userStats = await Promise.all(
      users.map(async (user) => {
        // Count direct messages (excluding PIN_NOTICE)
        const directMessageCount = await this.prisma.message.count({
          where: {
            authorId: user.id,
            directChatId: { not: null },
            type: { not: 'PIN_NOTICE' },
          },
        })

        // Count group messages (excluding PIN_NOTICE)
        const groupMessageCount = await this.prisma.message.count({
          where: {
            authorId: user.id,
            groupChatId: { not: null },
            type: { not: 'PIN_NOTICE' },
          },
        })

        // Get last message time (excluding PIN_NOTICE)
        const lastDirectMessage = await this.prisma.message.findFirst({
          where: {
            authorId: user.id,
            directChatId: { not: null },
            type: { not: 'PIN_NOTICE' },
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        })

        const lastGroupMessage = await this.prisma.message.findFirst({
          where: {
            authorId: user.id,
            groupChatId: { not: null },
            type: { not: 'PIN_NOTICE' },
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        })

        let lastMessageAt: string | undefined
        if (lastDirectMessage && lastGroupMessage) {
          lastMessageAt = new Date(
            Math.max(lastDirectMessage.createdAt.getTime(), lastGroupMessage.createdAt.getTime())
          ).toISOString()
        } else if (lastDirectMessage) {
          lastMessageAt = lastDirectMessage.createdAt.toISOString()
        } else if (lastGroupMessage) {
          lastMessageAt = lastGroupMessage.createdAt.toISOString()
        }

        return {
          userId: user.id,
          email: user.email,
          fullName: user.Profile?.fullName || 'Unknown',
          avatar: user.Profile?.avatar || undefined,
          directMessageCount,
          groupMessageCount,
          totalMessageCount: directMessageCount + groupMessageCount,
          lastMessageAt,
        }
      })
    )

    // Sort the results
    userStats.sort((a, b) => {
      let aValue: number | string
      let bValue: number | string

      switch (sortBy) {
        case 'directMessageCount':
          aValue = a.directMessageCount
          bValue = b.directMessageCount
          break
        case 'groupMessageCount':
          aValue = a.groupMessageCount
          bValue = b.groupMessageCount
          break
        case 'totalMessageCount':
          aValue = a.totalMessageCount
          bValue = b.totalMessageCount
          break
        case 'lastMessageAt':
          aValue = a.lastMessageAt || ''
          bValue = b.lastMessageAt || ''
          break
        default:
          aValue = a.totalMessageCount
          bValue = b.totalMessageCount
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return {
      users: userStats,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    }
  }

  private async generateChartData(startDate: Date, endDate: Date) {
    // Ensure endDate is set to end of day for accurate counting
    const adjustedEndDate = new Date(endDate)
    adjustedEndDate.setHours(23, 59, 59, 999)

    const days = Math.ceil(
      (adjustedEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    const userGrowth: Array<{ date: string; count: number }> = []
    const messageActivity: Array<{ date: string; count: number }> = []
    const groupChatActivity: Array<{ date: string; count: number }> = []

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
      const nextDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      const dateStr = currentDate.toISOString().split('T')[0]

      // Count new users for this day within the specified time range
      const newUsers = await this.prisma.user.count({
        where: {
          role: EAppRoles.USER,
          createdAt: {
            gte: currentDate,
            lt: nextDate,
          },
        },
      })

      // Count messages for this day within the specified time range (excluding PIN_NOTICE)
      const directMessages = await this.prisma.message.count({
        where: {
          directChatId: { not: null },
          type: { not: 'PIN_NOTICE' },
          createdAt: {
            gte: currentDate,
            lt: nextDate,
          },
        },
      })

      const groupMessages = await this.prisma.message.count({
        where: {
          groupChatId: { not: null },
          type: { not: 'PIN_NOTICE' },
          createdAt: {
            gte: currentDate,
            lt: nextDate,
          },
        },
      })

      const messages = directMessages + groupMessages

      // Count new group chats for this day within the specified time range
      const newGroupChats = await this.prisma.groupChat.count({
        where: {
          createdAt: {
            gte: currentDate,
            lt: nextDate,
          },
        },
      })

      userGrowth.push({ date: dateStr, count: newUsers })
      messageActivity.push({ date: dateStr, count: messages })
      groupChatActivity.push({ date: dateStr, count: newGroupChats })
    }

    // Generate message type distribution (Bar chart)
    const messageTypeDistribution = await this.generateMessageTypeDistribution()

    // Generate media message distribution (Stacked bar chart)
    const mediaMessageDistribution = await this.generateMediaMessageDistribution()

    return {
      userGrowth,
      messageActivity,
      groupChatActivity,
      messageTypeDistribution,
      mediaMessageDistribution,
    }
  }

  /**
   * Generate message type distribution for bar chart
   * Counts messages by main type: TEXT, STICKER, MEDIA
   */
  private async generateMessageTypeDistribution() {
    // Get TEXT messages
    const textCount = await this.prisma.message.count({
      where: {
        type: 'TEXT',
        isDeleted: false,
      },
    })

    // Get STICKER messages
    const stickerCount = await this.prisma.message.count({
      where: {
        type: 'STICKER',
        isDeleted: false,
      },
    })

    // Get MEDIA messages
    const mediaCount = await this.prisma.message.count({
      where: {
        type: 'MEDIA',
        isDeleted: false,
      },
    })

    return [
      { type: 'TEXT' as const, count: textCount },
      { type: 'STICKER' as const, count: stickerCount },
      { type: 'MEDIA' as const, count: mediaCount },
    ]
  }

  /**
   * Generate media message distribution for stacked bar chart
   * Counts only media messages by type: IMAGE, VIDEO, AUDIO, DOCUMENT
   */
  private async generateMediaMessageDistribution() {
    // Get all media messages with their types
    const mediaMessages = await this.prisma.message.findMany({
      where: {
        type: 'MEDIA',
        isDeleted: false,
        Media: {
          isNot: null,
        },
      },
      include: {
        Media: true,
      },
    })

    // Count media messages by type
    const imageCount = mediaMessages.filter((msg) => msg.Media?.type === 'IMAGE').length
    const videoCount = mediaMessages.filter((msg) => msg.Media?.type === 'VIDEO').length
    const audioCount = mediaMessages.filter((msg) => msg.Media?.type === 'AUDIO').length
    const documentCount = mediaMessages.filter((msg) => msg.Media?.type === 'DOCUMENT').length

    return [
      { type: 'IMAGE' as const, count: imageCount },
      { type: 'VIDEO' as const, count: videoCount },
      { type: 'AUDIO' as const, count: audioCount },
      { type: 'DOCUMENT' as const, count: documentCount },
    ]
  }

  /**
   * Emit socket events for deleted messages to update clients in real-time
   */
  private async emitDeletedMessagesUpdate(messageIds: number[]) {
    try {
      // Get all deleted messages with their chat information
      const deletedMessages = await this.prisma.message.findMany({
        where: { id: { in: messageIds } },
        include: {
          DirectChat: true,
          GroupChat: true,
          Author: {
            include: {
              Profile: true,
            },
          },
          Media: true,
          Sticker: true,
          ReplyTo: {
            include: {
              Author: {
                include: {
                  Profile: true,
                },
              },
              Media: true,
              Sticker: true,
            },
          },
        },
      })

      // Group messages by chat and emit updates
      for (const message of deletedMessages) {
        if (message.directChatId && message.DirectChat) {
          // Emit for direct chat
          const creatorSockets = this.userConnectionService.getConnectedClient(
            message.DirectChat.creatorId
          )
          const recipientSockets = this.userConnectionService.getConnectedClient(
            message.DirectChat.recipientId
          )
          if (creatorSockets && recipientSockets) {
            for (const creatorSocket of creatorSockets) {
              creatorSocket?.emit(EMessagingEmitSocketEvents.send_message_direct, message)
            }
            for (const recipientSocket of recipientSockets) {
              recipientSocket?.emit(EMessagingEmitSocketEvents.send_message_direct, message)
            }
          }
        } else if (message.groupChatId && message.GroupChat) {
          // Emit for group chat (if needed)
          // This would require getting all group members and emitting to them
          // For now, we'll focus on direct chats
        }
      }
    } catch (error) {
      console.error('Error emitting deleted messages update:', error)
    }
  }
}
