import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '@/configs/db/prisma.service'
import { EProviderTokens } from '@/utils/enums'
import { EMessageMediaTypes, EMessageTypes } from '@/message/message.enum'
import { ESortOrder } from './media-message.enum'
import type {
  TMediaItem,
  TPaginationInfo,
  TGetMediaMessagesResponse,
  TMediaFilters,
} from '@/message/media-message/media-message.type'
import dayjs from 'dayjs'
import { Prisma } from '@prisma/client'
import { DevLogger } from '@/dev/dev-logger'

@Injectable()
export class MediaMessageService {
  constructor(@Inject(EProviderTokens.PRISMA_CLIENT) private PrismaService: PrismaService) {}

  private readonly messageIncludeAuthor = {
    Author: {
      include: {
        Profile: true,
      },
    },
    Media: true,
  }

  /**
   * Get media messages with pagination and filters
   */
  async getMediaMessages(
    directChatId: number,
    filters: TMediaFilters = {},
    page: number = 1,
    limit: number = 20,
    sort: ESortOrder = ESortOrder.DESC
  ): Promise<TGetMediaMessagesResponse> {
    try {
      // Build where clause
      const whereClause = this.buildWhereClause(directChatId, filters)

      // Calculate offset
      const offset = (page - 1) * limit

      // Get total count
      const totalItems = await this.PrismaService.message.count({
        where: whereClause,
      })

      // Get items
      const items = await this.PrismaService.message.findMany({
        where: whereClause,
        include: this.messageIncludeAuthor,
        orderBy: {
          createdAt: sort === ESortOrder.ASC ? 'asc' : 'desc',
        },
        take: limit,
        skip: offset,
      })

      // Calculate pagination info
      const totalPages = Math.ceil(totalItems / limit)
      const hasMore = page < totalPages

      const pagination: TPaginationInfo = {
        currentPage: page,
        totalPages,
        totalItems,
        hasMore,
        limit,
      }

      const result: TGetMediaMessagesResponse = {
        success: true,
        data: {
          items: items as TMediaItem[],
          pagination,
        },
      }

      return result
    } catch (error) {
      console.error('[MediaMessageService] Error getting media messages:', error)
      return {
        success: false,
        data: {
          items: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            hasMore: false,
            limit,
          },
        },
        message: 'Failed to get media messages',
        errorCode: 'MEDIA_FETCH_ERROR',
        errors: error,
      }
    }
  }

  /**
   * Build where clause for database query
   */
  private buildWhereClause(directChatId: number, filters: TMediaFilters) {
    const baseWhere = {
      directChatId,
      isDeleted: false,
    }

    // Handle media type filter
    let typeCondition = {}

    // Priority: types array > single type > default
    if (filters.types && filters.types.length > 0) {
      // Handle multiple types - filter by Media.type for MEDIA messages
      const mediaTypes: string[] = []
      filters.types.forEach((type) => {
        switch (type) {
          case EMessageMediaTypes.IMAGE:
            mediaTypes.push(EMessageMediaTypes.IMAGE)
            break
          case EMessageMediaTypes.VIDEO:
            mediaTypes.push(EMessageMediaTypes.VIDEO)
            break
          case EMessageMediaTypes.DOCUMENT:
            mediaTypes.push(EMessageMediaTypes.DOCUMENT)
            break
          case EMessageMediaTypes.AUDIO:
            mediaTypes.push(EMessageMediaTypes.AUDIO)
            break
        }
      })
      typeCondition = {
        type: EMessageTypes.MEDIA,
        Media: {
          type: { in: mediaTypes },
        },
      }
    } else if (filters.types && filters.types.length === 0) {
      // Special case: empty types array means we want only TEXT messages (for links tab)
      typeCondition = {
        type: EMessageTypes.TEXT,
      }
    } else if (filters.type) {
      // Handle single type
      switch (filters.type) {
        case EMessageMediaTypes.IMAGE:
          typeCondition = {
            type: EMessageTypes.MEDIA,
            Media: {
              type: EMessageMediaTypes.IMAGE,
            },
          }
          break
        case EMessageMediaTypes.VIDEO:
          typeCondition = {
            type: EMessageTypes.MEDIA,
            Media: {
              type: EMessageMediaTypes.VIDEO,
            },
          }
          break
        case EMessageMediaTypes.DOCUMENT:
          typeCondition = {
            type: EMessageTypes.MEDIA,
            Media: {
              type: EMessageMediaTypes.DOCUMENT,
            },
          }
          break
        case EMessageMediaTypes.AUDIO:
          typeCondition = {
            type: EMessageTypes.MEDIA,
            Media: {
              type: EMessageMediaTypes.AUDIO,
            },
          }
          break
        default:
          // If no specific type, get all real media types + TEXT
          typeCondition = {
            OR: [
              {
                type: EMessageTypes.MEDIA,
                Media: {
                  type: {
                    in: [
                      EMessageMediaTypes.IMAGE,
                      EMessageMediaTypes.VIDEO,
                      EMessageMediaTypes.DOCUMENT,
                      EMessageMediaTypes.AUDIO,
                    ],
                  },
                },
              },
              {
                type: EMessageTypes.TEXT,
              },
            ],
          }
      }
    } else {
      // Default: get all real media types + TEXT messages (for links)
      typeCondition = {
        OR: [
          {
            type: EMessageTypes.MEDIA,
            Media: {
              type: {
                in: [
                  EMessageMediaTypes.IMAGE,
                  EMessageMediaTypes.VIDEO,
                  EMessageMediaTypes.DOCUMENT,
                  EMessageMediaTypes.AUDIO,
                ],
              },
            },
          },
          {
            type: EMessageTypes.TEXT,
          },
        ],
      }
    }

    // Handle sender filter
    const senderCondition = filters.senderId ? { authorId: filters.senderId } : {}

    // Handle date filters
    let dateCondition = {}
    if (filters.fromDate || filters.toDate) {
      const dateFilter: Prisma.DateTimeFilter = {}
      if (filters.fromDate) {
        dateFilter.gte = dayjs(filters.fromDate).startOf('day').toDate()
      }
      if (filters.toDate) {
        dateFilter.lte = dayjs(filters.toDate).endOf('day').toDate()
      }
      dateCondition = { createdAt: dateFilter }
    }

    return {
      ...baseWhere,
      ...typeCondition,
      ...senderCondition,
      ...dateCondition,
    }
  }

  /**
   * Get media statistics for a chat
   */
  async getMediaStatistics(directChatId: number) {
    try {
      // Get all media messages for this chat
      const messages = await this.PrismaService.message.findMany({
        where: {
          directChatId,
          isDeleted: false,
          OR: [
            {
              type: EMessageTypes.MEDIA,
              Media: {
                type: {
                  in: [
                    EMessageMediaTypes.IMAGE,
                    EMessageMediaTypes.VIDEO,
                    EMessageMediaTypes.DOCUMENT,
                    EMessageMediaTypes.AUDIO,
                  ],
                },
              },
            },
            {
              type: EMessageTypes.TEXT,
            },
          ],
        },
        include: {
          Media: true,
        },
      })

      const result = {
        total: 0,
        images: 0,
        videos: 0,
        files: 0,
        voices: 0,
      }

      messages.forEach((message) => {
        if (message.type === EMessageTypes.MEDIA && message.Media) {
          result.total++
          switch (message.Media.type) {
            case EMessageMediaTypes.IMAGE:
              result.images++
              break
            case EMessageMediaTypes.VIDEO:
              result.videos++
              break
            case EMessageMediaTypes.DOCUMENT:
              result.files++
              break
            case EMessageMediaTypes.AUDIO:
              result.voices++
              break
          }
        }
      })

      const response = {
        success: true,
        data: result,
      }

      return response
    } catch (error) {
      DevLogger.logError('[MediaMessageService] Error getting media statistics:', error)
      return {
        success: false,
        data: null,
        message: 'Failed to get media statistics',
        errorCode: 'MEDIA_STATS_ERROR',
        errors: error,
      }
    }
  }
}
