import { Injectable } from '@nestjs/common'
import type {
  TGlobalSearchData,
  TMessageSearchOffset,
  TUserSearchOffset,
  TConversationSearchResult,
} from './search.type'
import { ElasticsearchService } from '@/configs/elasticsearch/elasticsearch.service'
import { MessageService } from '@/message/message.service'
import { UserService } from '@/user/user.service'
import { replaceHTMLTagInMessageContent } from '@/utils/helpers'
import { EChatType } from '@/utils/enums'
import { UserConnectionService } from '@/connection/user-connection.service'
import { DirectChatService } from '@/direct-chat/direct-chat.service'
import { GroupChatService } from '@/group-chat/group-chat.service'
import { PrismaService } from '@/configs/db/prisma.service'
import { EProviderTokens } from '@/utils/enums'
import { Inject } from '@nestjs/common'
import { DevLogger } from '@/dev/dev-logger'

@Injectable()
export class SearchService {
  constructor(
    private elasticSearchService: ElasticsearchService,
    private MessageService: MessageService,
    private userService: UserService,
    private userConnectionService: UserConnectionService,
    private directChatService: DirectChatService,
    private groupChatService: GroupChatService,
    @Inject(EProviderTokens.PRISMA_CLIENT) private prismaService: PrismaService
  ) {}

  async searchGlobally(
    keyword: string,
    userId: number,
    limit: number,
    selfUserId: number,
    messageSearchOffset?: TMessageSearchOffset,
    userSearchOffset?: TUserSearchOffset
  ): Promise<TGlobalSearchData> {
    const [messageHits, userHits] = await Promise.all([
      this.elasticSearchService.searchMessages(keyword, userId, limit, messageSearchOffset),
      this.elasticSearchService.searchUsers(keyword, limit, userSearchOffset),
    ])
    const messageIdObjects = messageHits
      .filter((message) => !!message._source)
      .map((message) => ({
        id: parseInt(message._id!),
        highlight: message.highlight,
      }))
    const messageIds = messageIdObjects.map((message) => message.id)
    const userIds = userHits.filter((user) => !!user._source).map((user) => parseInt(user._id!))
    // find messages and users by ids in database
    const [messages, users] = await Promise.all([
      this.MessageService.findMessagesForGlobalSearch(messageIds, limit),
      this.userService.findUsersForGlobalSearch(userIds, selfUserId, limit),
    ])
    const finalMessages = messages.map<TGlobalSearchData['messages'][number]>(
      ({ id, GroupChat, content, directChatId, groupChatId, createdAt, Author, Media }) => {
        let avatarUrl: string | undefined,
          conversationName: string = ''
        if (Author) {
          const authorProfile = Author.Profile
          avatarUrl = authorProfile?.avatar || undefined
          conversationName = authorProfile?.fullName || ''
        } else {
          avatarUrl = GroupChat!.Members[0].User.Profile!.avatar || undefined
          conversationName = GroupChat!.name
        }
        return {
          id,
          avatarUrl,
          conversationName,
          messageContent: replaceHTMLTagInMessageContent(content),
          mediaContent: Media?.fileName,
          highlights: messageIdObjects.find((m) => m.id === id)!.highlight?.content || [],
          chatType: directChatId ? EChatType.DIRECT : EChatType.GROUP,
          chatId: (directChatId || groupChatId)!,
          createdAt: createdAt.toISOString(),
        }
      }
    )
    const finalUsers = users.map((user) => ({
      ...user,
      isOnline: this.userConnectionService.checkUserIsOnline(user.id),
    }))
    const nextSearchOffset: TGlobalSearchData['nextSearchOffset'] = {
      messageSearchOffset: messageHits.at(-1)?.sort,
      userSearchOffset: userHits.at(-1)?.sort,
    }
    return {
      messages: finalMessages,
      users: finalUsers,
      nextSearchOffset,
    }
  }

  async searchConversations(
    keyword: string,
    userId: number,
    limit: number = 10
  ): Promise<TConversationSearchResult[]> {
    const searchKeyword = keyword.toLowerCase().trim()

    // Tìm kiếm direct chats
    const directChats = await this.prismaService.directChat.findMany({
      where: {
        AND: [
          {
            OR: [{ creatorId: userId }, { recipientId: userId }],
          },
          {
            OR: [
              {
                Creator: {
                  Profile: {
                    fullName: {
                      contains: searchKeyword,
                      mode: 'insensitive',
                    },
                  },
                },
              },
              {
                Recipient: {
                  Profile: {
                    fullName: {
                      contains: searchKeyword,
                      mode: 'insensitive',
                    },
                  },
                },
              },
              {
                Creator: {
                  email: {
                    contains: searchKeyword,
                    mode: 'insensitive',
                  },
                },
              },
              {
                Recipient: {
                  email: {
                    contains: searchKeyword,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          },
        ],
      },
      include: {
        Creator: {
          include: {
            Profile: true,
          },
        },
        Recipient: {
          include: {
            Profile: true,
          },
        },
        LastSentMessage: true,
      },
      take: limit,
    })

    // Tìm kiếm group chats
    const groupChats = await this.prismaService.groupChat.findMany({
      where: {
        Members: {
          some: {
            userId: userId,
          },
        },
        name: {
          contains: searchKeyword,
          mode: 'insensitive',
        },
      },
      include: {
        LastSentMessage: true,
      },
      take: limit,
    })

    // Chuyển đổi direct chats thành format mong muốn
    const directChatResults: TConversationSearchResult[] = directChats.map((chat) => {
      const otherUser = chat.creatorId === userId ? chat.Recipient : chat.Creator
      return {
        id: chat.id,
        type: EChatType.DIRECT,
        title: otherUser.Profile?.fullName || otherUser.email,
        email: otherUser.email,
        avatar: otherUser.Profile?.avatar ? { src: otherUser.Profile.avatar } : undefined,
        subtitle: chat.LastSentMessage ? { content: chat.LastSentMessage.content } : undefined,
      }
    })

    // Chuyển đổi group chats thành format mong muốn
    const groupChatResults: TConversationSearchResult[] = groupChats.map((chat) => ({
      id: chat.id,
      type: EChatType.GROUP,
      title: chat.name,
      avatar: chat.avatarUrl ? { src: chat.avatarUrl } : undefined,
      subtitle: chat.LastSentMessage ? { content: chat.LastSentMessage.content } : undefined,
    }))

    // Kết hợp và giới hạn kết quả
    const allResults = [...directChatResults, ...groupChatResults]
    return allResults.slice(0, limit)
  }
}
