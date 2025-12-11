import { EProviderTokens } from '@/utils/enums'
import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common'
import { PrismaService } from '@/configs/db/prisma.service'
import { MessageService } from '@/message/message.service'
import { ElasticsearchService } from '@/configs/elasticsearch/elasticsearch.service'
import { measureTime, parseTxtFileToObject } from './helpers'
import { DevLogger } from './dev-logger'
import { SyncDataToESService } from '@/configs/elasticsearch/sync-data-to-ES/sync-data-to-ES.service'

@Controller('dev')
export class DevController {
  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private PrismaService: PrismaService,
    private MessageService: MessageService,
    private elasticsearchService: ElasticsearchService,
    private syncDataToESService: SyncDataToESService
  ) {}

  @Get('dl-all-msg')
  async deleteAllMessages() {
    await this.PrismaService.message.deleteMany()
  }

  @Post('all-msg')
  async getAllMessages(@Body() payload: any) {
    const { msgOffset, directChatId, limit, sortType } = payload
    const res = await this.MessageService.getOlderDirectMessagesHandler(
      msgOffset,
      directChatId,
      undefined,
      limit,
      false,
      sortType
    )
    DevLogger.logInfo('res:', res)
  }

  @Get('init-data')
  async initData(@Query() query: any) {
    // sync users to elasticsearch
    const obj = await parseTxtFileToObject('./temp.txt')
    const { key: objKey } = obj
    const { key: queryKey } = query
    if (!objKey || !queryKey || queryKey !== objKey) {
      DevLogger.logInfo('objKey or queryKey is required')
      return { success: false, error: 'objKey or queryKey is required' }
    }
    const users = await this.PrismaService.user.findMany({ include: { Profile: true } })
    for (const user of users) {
      DevLogger.logInfo('user:', user)
      await this.elasticsearchService.createUser(user.id, {
        doc_id: user.id,
        full_name: user.Profile?.fullName || '',
        email: user.email,
      })
      DevLogger.logInfo('run this create new doc successfully')
    }
    return { success: true }
  }

  @Get('todo')
  async todo(@Query() query: any) {
    const { keyword, limit } = query
    if (!keyword || !limit) {
      DevLogger.logInfo('keyword or limit is required')
      return { success: false, error: 'keyword or limit is required' }
    }
    await this.elasticsearchService.searchUsers(keyword, limit)
    return { success: true }
  }

  @Get('sync-all-data-to-es')
  async syncAllDataToES() {
    DevLogger.logInfo('sync all data to es')
    measureTime(async () => {
      this.syncDataToESService.initWorker()
    })
    await this.syncDataToESService.syncUsersAndMessagesDataToES()
    return { success: true }
  }

  @Get('delete-all-data-from-es')
  async deleteAllDataFromES() {
    await this.elasticsearchService.deleteAllDataFromES()
    return { success: true }
  }

  @Get('count-all-data-from-es')
  async countAllDataFromES() {
    const messagesFromDB = await this.PrismaService.message.count()
    const messagesFromES = await this.elasticsearchService.countAllMessages()
    const usersFromDB = await this.PrismaService.user.count()
    const usersFromES = await this.elasticsearchService.countAllUsers()
    return {
      success: true,
      ES: {
        messages: messagesFromES,
        users: usersFromES,
      },
      DB: {
        messages: messagesFromDB,
        users: usersFromDB,
      },
    }
  }
}
