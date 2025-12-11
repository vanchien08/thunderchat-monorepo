import { PrismaClient } from '@prisma/client'
import {
  ConnectionException,
  BulkDeleteException,
  UnknownException,
  WorkerInputDataException,
  WorkerResponseException,
} from '@/utils/exceptions/system.exception'
import type { TMessage } from '@/utils/entities/message.entity'
import type { TWorkerResponse } from '@/utils/types'
import { isMainThread, parentPort } from 'worker_threads'
import { SyncDataToESWorkerMessageDTO } from './sync-data-to-ES.dto'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { EMessageTypes, EMessageMediaTypes } from '@/message/message.enum'
import { ESyncDataToESWorkerType } from '@/utils/enums'
import { Client } from '@elastic/elasticsearch'
import { EESIndexes } from '@/configs/elasticsearch/elasticsearch.enum'
import { ESyncDataToESMessages } from './sync-data-to-ES.message'
import { retryAsyncRequest, typeToRawObject, replaceHTMLTagInMessageContent } from '@/utils/helpers'
import type { TMessageESMapping, TUserESMapping } from '@/configs/elasticsearch/elasticsearch.type'
import { NotFoundException } from '@nestjs/common'
import {
  TCastedMessage,
  TCastedMessageWithMedia,
  TCastedUserWithProfile,
} from './sync-data-to-ES.type'
import ESMessageEncryptor from '@/message/security/es-message-encryptor'
import { SymmetricTextEncryptor } from '@/utils/crypto/symmetric-text-encryptor.crypto'

type TCheckInputDataResult = {
  messageData: SyncDataToESWorkerMessageDTO
  prismaClient: PrismaClient
  syncDataToESHandler: SyncDataToESHandler
  esMsgEncryptor?: ESMessageEncryptor
}

class SyncDataToESHandler {
  private readonly MAX_RETRIES: number = 3
  private ESClient: Client
  private esMsgEncryptor?: ESMessageEncryptor

  constructor(ESClient: Client, esMsgEncryptor?: ESMessageEncryptor) {
    this.ESClient = ESClient
    this.esMsgEncryptor = esMsgEncryptor
  }

  recursiveCreateUpdateMessage = async (
    message: TCastedMessageWithMedia,
    prismaClient: PrismaClient
  ): Promise<void> => {
    try {
      await retryAsyncRequest(
        async () => {
          let validUserIds: number[] = []
          const { directChatId, recipientId, groupChatId, authorId, id, content, type, createdAt } =
            message
          if (directChatId && recipientId) {
            validUserIds = [recipientId, authorId]
          } else if (groupChatId) {
            const groupChat = await prismaClient.groupChat.findUnique({
              where: { id: groupChatId },
              select: {
                Members: {
                  select: {
                    userId: true,
                  },
                },
              },
            })
            if (!groupChat) {
              throw new NotFoundException(ESyncDataToESMessages.GROUP_CHAT_NOT_FOUND)
            }
            validUserIds = groupChat.Members.map(({ userId }) => userId)
          }
          await this.ESClient.index({
            index: EESIndexes.MESSAGES,
            id: id.toString(),
            document: typeToRawObject<TMessageESMapping>({
              doc_id: id,
              content,
              original_content: content,
              message_type: type as EMessageTypes,
              valid_user_ids: validUserIds,
              created_at: createdAt as unknown as string,
              is_deleted: false,
            }),
          })
        },
        { maxRetries: this.MAX_RETRIES }
      )
    } catch (error) {
      throw new UnknownException(ESyncDataToESMessages.SYNC_MESSAGE_ERROR, error)
    }
  }

  recursiveDeleteMessage = async (message: TCastedMessage): Promise<void> => {
    try {
      await retryAsyncRequest(
        async () => {
          await this.ESClient.update({
            index: EESIndexes.MESSAGES,
            id: message.id.toString(),
            doc: typeToRawObject<Partial<TMessageESMapping>>({
              is_deleted: true,
              content: '',
              original_content: '',
            }),
          })
        },
        { maxRetries: this.MAX_RETRIES }
      )
    } catch (error) {
      throw new UnknownException(ESyncDataToESMessages.SYNC_MESSAGE_ERROR, error)
    }
  }

  recursiveDeleteMessagesInBulk = async (messages: TMessage['id'][]): Promise<void> => {
    await retryAsyncRequest(
      async () => {
        const response = await this.ESClient.bulk({
          operations: messages.map((id) => ({
            delete: {
              _index: EESIndexes.MESSAGES,
              _id: id.toString(),
            },
          })),
        })
        const { errors } = response
        if (errors) {
          throw new BulkDeleteException(ESyncDataToESMessages.SYNC_MESSAGE_ERROR)
        }
      },
      { maxRetries: this.MAX_RETRIES }
    )
  }

  recursiveCreateUpdateUser = async (user: TCastedUserWithProfile): Promise<void> => {
    try {
      await retryAsyncRequest(
        async () => {
          const { id, email, Profile } = user
          await this.ESClient.index({
            index: EESIndexes.USERS,
            id: id.toString(),
            document: typeToRawObject<TUserESMapping>({
              doc_id: id,
              email: email,
              full_name: Profile?.fullName || '',
            }),
          })
        },
        { maxRetries: this.MAX_RETRIES }
      )
    } catch (error) {
      throw new UnknownException(ESyncDataToESMessages.SYNC_USER_ERROR, error)
    }
  }

  recursiveSyncAllUsersAndMessages = async (prismaClient: PrismaClient): Promise<void> => {
    const messages = await prismaClient.message.findMany({
      include: {
        Media: true,
      },
    })
    const users = await prismaClient.user.findMany({
      include: {
        Profile: true,
      },
    })
    console.log('>>> messages count: ', messages.length)
    console.log('>>> users count: ', users.length)
    console.log('>>> start sync messages')
    await Promise.all(
      messages.map(async (msg) => {
        await this.recursiveCreateUpdateMessage(
          {
            ...msg,
            createdAt: msg.createdAt.toISOString(),
            Media: msg.Media
              ? { ...msg.Media, createdAt: msg.Media.createdAt.toISOString() }
              : null,
          },
          prismaClient
        )
      })
    )
    console.log('>>> start sync users')
    await Promise.all(
      users.map(async (user) => {
        await this.recursiveCreateUpdateUser({
          ...user,
          createdAt: user.createdAt.toISOString(),
          Profile: user.Profile
            ? { ...user.Profile, createdAt: user.Profile.createdAt.toISOString() }
            : null,
        })
      })
    )
    console.log('>>> end sync users and messages')
  }
}

const checkInputData = async (
  workerData: SyncDataToESWorkerMessageDTO
): Promise<TCheckInputDataResult> => {
  const workerDataInstance = plainToInstance(SyncDataToESWorkerMessageDTO, workerData)
  const errors = await validate(workerDataInstance)
  if (errors.length > 0) {
    throw new WorkerInputDataException(
      `Validation failed: ${errors.map((e) => Object.values(e.constraints || {})).join(', ')}`
    )
  }
  const ESClient = new Client({
    node: process.env.ELASTICSEARCH_URL,
    auth: { apiKey: process.env.ELASTIC_API_KEY },
    serverMode: 'serverless',
  })
  const prismaClient = new PrismaClient()
  try {
    const pingSuccess = await ESClient.ping()
    if (!pingSuccess) {
      throw new ConnectionException(ESyncDataToESMessages.ES_PING_ERROR)
    }
    await prismaClient.$connect()
  } catch (error) {
    throw new ConnectionException(ESyncDataToESMessages.SYNC_ES_CONNECTION_ERROR, error)
  }

  let syncDataToESHandler: SyncDataToESHandler | undefined = undefined
  let esMsgEncryptor: ESMessageEncryptor | undefined = undefined
  if (!workerData.message && !workerData.user) {
    // Khởi tạo ESMessageEncryptor
    const symmetricTextEncryptor = new SymmetricTextEncryptor()
    const messageMappings = await prismaClient.messageMapping.findUnique({
      where: { versionCode: process.env.MESSAGE_MAPPINGS_VERSION_CODE },
    })
    if (messageMappings) {
      const { mappings, key, dek } = messageMappings
      const decryptedDek = symmetricTextEncryptor.decrypt(
        dek,
        process.env.MESSAGE_MAPPINGS_SECRET_KEY
      )
      esMsgEncryptor = new ESMessageEncryptor(
        symmetricTextEncryptor.decrypt(key, decryptedDek),
        symmetricTextEncryptor.decrypt(mappings, decryptedDek),
        decryptedDek
      )
    } else {
      esMsgEncryptor = new ESMessageEncryptor(
        ESMessageEncryptor.generateESMessageSecretKey(),
        null,
        symmetricTextEncryptor.generateEncryptionKey()
      )
    }
  }
  syncDataToESHandler = new SyncDataToESHandler(ESClient, esMsgEncryptor)

  return {
    messageData: workerDataInstance,
    prismaClient,
    syncDataToESHandler,
    esMsgEncryptor,
  }
}

const runWorker = async (workerData: SyncDataToESWorkerMessageDTO): Promise<void> => {
  if (isMainThread) return
  console.log('>>> launch worker 2')

  const { messageData, prismaClient, syncDataToESHandler, esMsgEncryptor } =
    await checkInputData(workerData)
  const { type, message, messageIds, user } = messageData
  console.log('>>> type after checkInputData:', type)
  console.log('>>> message after checkInputData:', message)
  console.log('>>> user after checkInputData:', user)

  switch (type) {
    case ESyncDataToESWorkerType.CREATE_MESSAGE:
      await syncDataToESHandler.recursiveCreateUpdateMessage(message!, prismaClient)
      break
    case ESyncDataToESWorkerType.UPDATE_MESSAGE:
      await syncDataToESHandler.recursiveCreateUpdateMessage(message!, prismaClient)
      break
    case ESyncDataToESWorkerType.DELETE_MESSAGE:
      await syncDataToESHandler.recursiveDeleteMessage(message!)
      break
    case ESyncDataToESWorkerType.CREATE_USER:
      await syncDataToESHandler.recursiveCreateUpdateUser(user!)
      break
    case ESyncDataToESWorkerType.UPDATE_USER:
      await syncDataToESHandler.recursiveCreateUpdateUser(user!)
      break
    case ESyncDataToESWorkerType.ALL_USERS_AND_MESSAGES:
      await syncDataToESHandler.recursiveSyncAllUsersAndMessages(prismaClient)

      // Update message mappings sau khi sync
      const symmetricTextEncryptor = new SymmetricTextEncryptor()
      if (!esMsgEncryptor) break
      const messageMappings = esMsgEncryptor.getMappings()
      const secretKey = esMsgEncryptor.getSecretKey()
      const dek = esMsgEncryptor.getDek()

      const encryptedMappings = symmetricTextEncryptor.encrypt(messageMappings, dek)
      const existing = await prismaClient.messageMapping.findUnique({
        where: { versionCode: process.env.MESSAGE_MAPPINGS_VERSION_CODE },
      })

      if (existing) {
        await prismaClient.messageMapping.update({
          where: { id: existing.id },
          data: { mappings: encryptedMappings },
        })
      } else {
        await prismaClient.messageMapping.create({
          data: {
            mappings: encryptedMappings,
            key: symmetricTextEncryptor.encrypt(secretKey, dek),
            dek: symmetricTextEncryptor.encrypt(dek, process.env.MESSAGE_MAPPINGS_SECRET_KEY),
            versionCode: process.env.MESSAGE_MAPPINGS_VERSION_CODE,
          },
        })
      }

      break
    case ESyncDataToESWorkerType.DELETE_MESSAGES_IN_BULK:
      await syncDataToESHandler.recursiveDeleteMessagesInBulk(messageIds!)
      break
  }

  parentPort?.postMessage(
    typeToRawObject<TWorkerResponse<null>>({
      success: true,
      data: null,
    })
  )
}

parentPort?.on('message', (message) => {
  runWorker(message).catch((error) => {
    console.error('>>> sync data to es worker error:', error)
    parentPort?.postMessage(
      typeToRawObject<TWorkerResponse<null>>({
        success: false,
        error: new WorkerResponseException(`Worker errors occured: ${error}`, error),
      })
    )
  })
})
