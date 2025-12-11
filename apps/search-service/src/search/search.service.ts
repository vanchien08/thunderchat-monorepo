import { Injectable } from '@nestjs/common'
import type {
  TGlobalSearchData,
  TMessageSearchOffset,
  TUserSearchOffset,
  TConversationSearchResult,
  TMessageIdObject,
} from './search.type'
import { ElasticsearchService } from '@/configs/elasticsearch/elasticsearch.service'
import { MessageService } from '@/configs/communication/grpc/services/message.service'
import { UserService } from '@/configs/communication/grpc/services/user.service'
import { replaceHTMLTagInMessageContent } from '@/utils/helpers'
import { EChatType, EGrpcPackages, EGrpcServices } from '@/utils/enums'
import { UserConnectionService } from '@/configs/communication/grpc/services/user-connection.service'
import { PrismaService } from '@/configs/db/prisma.service'
import { EProviderTokens } from '@/utils/enums'
import { Inject } from '@nestjs/common'
import { DevLogger } from '@/dev/dev-logger'
import { ClientGrpc } from '@nestjs/microservices'

@Injectable()
export class SearchService {
  private messageService: MessageService
  private userService: UserService
  private userConnectionService: UserConnectionService

  constructor(
    private elasticSearchService: ElasticsearchService,
    @Inject(EGrpcPackages.CONVERSATION_PACKAGE)
    private readonly messageGrpcClient: ClientGrpc,
    @Inject(EGrpcPackages.USER_PACKAGE)
    private readonly userGrpcClient: ClientGrpc,
    @Inject(EGrpcPackages.CHAT_PACKAGE)
    private readonly userConnectGrpcClient: ClientGrpc,
    @Inject(EProviderTokens.PRISMA_CLIENT) private prismaService: PrismaService
  ) {
    this.messageService = new MessageService(
      this.messageGrpcClient.getService(EGrpcServices.MESSAGE_SERVICE)
    )
    this.userService = new UserService(this.userGrpcClient.getService(EGrpcServices.USER_SERVICE))
    this.userConnectionService = new UserConnectionService(
      this.userConnectGrpcClient.getService(EGrpcServices.USER_CONNECTION_SERVICE)
    )
  }

  async searchGlobally(
    keyword: string,
    userId: number,
    limit: number,
    selfUserId: number,
    messageSearchOffset?: TMessageSearchOffset,
    userSearchOffset?: TUserSearchOffset
  ): Promise<TGlobalSearchData> {
    let finalMessages: TGlobalSearchData['messages'] = []
    let finalUsers: TGlobalSearchData['users'] = []
    const [messageHits, userHits] = await Promise.all([
      this.elasticSearchService.searchMessages(keyword, userId, limit, messageSearchOffset),
      this.elasticSearchService.searchUsers(keyword, limit, userSearchOffset),
    ])
    console.log('>>> message hits:', messageHits)
    console.log('>>> user hits:', userHits)
    let messageIds: number[] = []
    let highlights: string[] = []
    let messageIdObjects: TMessageIdObject[] = []
    if (messageHits.length > 0) {
      messageIdObjects = messageHits
        .filter((message) => !!message._source)
        .map((message) => ({
          id: parseInt(message._id!),
          highlight: message.highlight,
        }))
      highlights
      messageIds = messageIdObjects.map((message) => message.id)
    }
    let userIds: number[] = []
    if (userHits.length > 0) {
      userIds = userHits.filter((user) => !!user._source).map((user) => parseInt(user._id!))
    }
    // find messages and users by ids in database
    const [messages, users] = await Promise.all([
      messageIds.length > 0
        ? this.messageService.findMessagesForGlobalSearch(messageIds, limit)
        : null,
      userIds.length > 0
        ? this.userService.findUsersForGlobalSearch(userIds, selfUserId, limit)
        : null,
    ])
    if (messages && messages.length > 0) {
      finalMessages = messages.map<TGlobalSearchData['messages'][number]>(
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
            createdAt,
          }
        }
      )
    }
    if (users && users.length > 0) {
      finalUsers = await Promise.all(
        users.map(async (user) => ({
          ...user,
          isOnline: await this.userConnectionService.checkUserIsOnline(user.id),
        }))
      )
    }
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
