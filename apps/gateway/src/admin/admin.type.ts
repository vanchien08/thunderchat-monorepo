export type TAdminUser = {
  id: number
  email: string
  fullName: string
  avatar?: string
  birthday?: string | null
  about?: string | null
  status: string
  createdAt: string
}

export type TAdminUsersData = {
  users: TAdminUser[]
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export type TGetAdminUsersParams = {
  page: number
  limit: number
  search?: string
  status?: 'all' | 'NORMAL' | 'WARNING' | 'TEMPORARY_BAN' | 'PERMANENT_BAN'
}

export type TLockUnlockUserParams = {
  userId: number
  isLocked: boolean
}

export type TDeleteUserParams = {
  userId: number
}

export type TUpdateUserEmailResponse = {
  success: boolean
  message: string
  error?: string
}

// Violation Reports Types - Updated to match Prisma schema
export type TViolationReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED'
export type TViolationReportCategory = 'SENSITIVE_CONTENT' | 'BOTHER' | 'FRAUD' | 'OTHER'
export type TViolationReportActionType = 'WARNING' | 'TEMPORARY_BAN' | 'PERMANENT_BAN'

export type TViolationReportEvidence = {
  images: number
  messages: number
}

export type TViolationReport = {
  id: number
  reporterId: number
  reporterName: string
  reporterEmail: string
  reportedUserId: number
  reportedUserName: string
  reportedUserEmail: string
  reportCategory: TViolationReportCategory
  reasonText?: string | null
  status: TViolationReportStatus
  evidenceCount: TViolationReportEvidence
  createdAt: string
  updatedAt: string
}

export type TViolationAction = {
  id: number
  actionType: TViolationReportActionType
  actionReason: string
  bannedUntil: string | null
  createdAt: string
}

export type TViolationReportDetail = {
  id: number
  reporterId: number
  reporterName: string
  reporterEmail: string
  reportedUserId: number
  reportedUserName: string
  reportedUserEmail: string
  reportCategory: TViolationReportCategory
  reasonText?: string | null
  status: TViolationReportStatus
  evidenceCount: TViolationReportEvidence
  reportImages: Array<{
    id: number
    imageUrl: string
    createdAt: string
  }>
  reportedMessages: Array<{
    id: number
    messageId: number
    messageType: string
    messageContent: string
    createdAt: string
    senderName: string
    senderAvatar: string
    senderId: number
  }>
  violationAction: TViolationAction | null
  latestBanAction: TViolationAction | null
  createdAt: string
  updatedAt: string
}

export type TViolationReportsData = {
  reports: TViolationReport[]
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  statistics: {
    total: number
    pending: number
    resolved: number
    dismissed: number
  }
}

export type TSystemOverviewData = {
  activeUsers: number
  totalMessages: number
  totalDirectMessages: number
  totalGroupMessages: number
  activeGroupChats: number
  totalUsers: number
  totalViolationReports: number
  resolvedViolationReports: number
  pendingViolationReports: number
  dismissedViolationReports: number
  timeRange: {
    startDate: string
    endDate: string
    period: 'day' | 'week' | 'month' | 'year' | 'custom'
  }
  charts?: {
    userGrowth?: Array<{ date: string; count: number }>
    messageActivity?: Array<{ date: string; count: number }>
    groupChatActivity?: Array<{ date: string; count: number }>
    // Bar chart: Số tin nhắn theo loại chính (TEXT, STICKER, MEDIA)
    messageTypeDistribution?: Array<{
      type: 'TEXT' | 'STICKER' | 'MEDIA'
      count: number
    }>
    // Stacked bar: Tin nhắn media theo loại (IMAGE, VIDEO, AUDIO, DOCUMENT)
    mediaMessageDistribution?: Array<{
      type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
      count: number
    }>
  }
}

export type TGetSystemOverviewParams = {
  timeRange?: 'day' | 'week' | 'month' | 'year'
  startDate?: string
  endDate?: string
}

export type TUserMessageStats = {
  userId: number
  email: string
  fullName: string
  avatar?: string
  directMessageCount: number
  groupMessageCount: number
  totalMessageCount: number
  lastMessageAt?: string
}

export type TGetUserMessageStatsParams = {
  page: number
  limit: number
  search?: string
  sortBy?: 'directMessageCount' | 'groupMessageCount' | 'totalMessageCount' | 'lastMessageAt'
  sortOrder?: 'asc' | 'desc'
}

export type TGetUserMessageStatsData = {
  users: TUserMessageStats[]
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export type TGetViolationReportsParams = {
  page: number
  limit: number
  search?: string
  status?: TViolationReportStatus | 'ALL'
  category?: TViolationReportCategory | 'ALL'
  startDate?: string
  endDate?: string
  sortBy?: 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

export type TUpdateViolationReportStatusResponse = {
  success: boolean
  message: string
  error?: string
}

export type TBanUserResponse = {
  success: boolean
  message: string
  error?: string
}

export type TUserReportHistoryItem = {
  id: number
  reportCategory: TViolationReportCategory
  status: TViolationReportStatus
  createdAt: string
  reasonText: string | null
  // For 'reported' type (reports made by user)
  reportedUserName?: string
  reportedUserEmail?: string
  // For 'reportedBy' type (reports about user)
  reporterName?: string
  reporterEmail?: string
}

export type TUserReportHistoryData = {
  reports: TUserReportHistoryItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type TGetUserReportHistoryParams = {
  userId: number
  type: 'reported' | 'reportedBy'
  page?: number
  limit?: number
}
