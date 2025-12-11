import { PrismaClient } from '@prisma/client'
import {
  ConnectionException,
  BulkDeleteException,
  UnknownException,
  WorkerInputDataException,
  WorkerResponseException,
} from '@/utils/exceptions/system.exception'
import type { TMessage, TMessageWithMedia } from '@/utils/entities/message.entity'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import type { TWorkerResponse } from '@/utils/types'
import { isMainThread, parentPort } from 'worker_threads'
import { SyncDataToESWorkerMessageDTO } from './sync-data-to-ES.dto'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { EMessageMediaTypes, EMessageTypes } from '@/message/message.enum'
import { EMsgEncryptionAlgorithms, ESyncDataToESWorkerType } from '@/utils/enums'
import { Client } from '@elastic/elasticsearch'
import { EESIndexes } from '@/configs/elasticsearch/elasticsearch.enum'
import { ESyncDataToESMessages } from './sync-data-to-ES.message'
import { replaceHTMLTagInMessageContent, retryAsyncRequest, typeToRawObject } from '@/utils/helpers'
import UserMessageEncryptor from '@/message/security/es-message-encryptor'
import type { TMessageESMapping, TUserESMapping } from '@/configs/elasticsearch/elasticsearch.type'
import { SymmetricEncryptor } from '@/utils/crypto/symmetric-encryption.crypto'
import { NotFoundException } from '@nestjs/common'

type TCheckInputDataResult = {
  messageData: SyncDataToESWorkerMessageDTO
  prismaClient: PrismaClient
  syncDataToESHandler: SyncDataToESHandler
}

class SyncDataToESHandler {
  private readonly MAX_RETRIES: number = 3

  constructor(private ESClient: Client) {}

  recursiveCreateUpdateMessage = async (
    message: TMessageWithMedia,
    prismaClient: PrismaClient
  ): Promise<void> => {
    try {
      await retryAsyncRequest(
        async () => {
          let validUserIds: number[] = []
          const {
            directChatId,
            recipientId,
            groupChatId,
            authorId,
            id,
            content,
            type,
            createdAt,
            Media,
          } = message
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
          const docContent =
            type === EMessageTypes.MEDIA && Media && Media.type === EMessageMediaTypes.DOCUMENT
              ? Media.fileName || replaceHTMLTagInMessageContent(content)
              : replaceHTMLTagInMessageContent(content)
          await this.ESClient.index({
            index: EESIndexes.MESSAGES,
            id: id.toString(),
            document: typeToRawObject<TMessageESMapping>({
              doc_id: id,
              content: docContent,
              original_content: content,
              message_type: type as EMessageTypes,
              valid_user_ids: validUserIds,
              created_at: createdAt.toISOString(),
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

  recursiveDeleteMessage = async (message: TMessage): Promise<void> => {
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

  recursiveCreateUpdateUser = async (user: TUserWithProfile): Promise<void> => {
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
        await this.recursiveCreateUpdateMessage(msg, prismaClient)
      })
    )
    console.log('>>> start sync users')
    await Promise.all(
      users.map(async (user) => {
        await this.recursiveCreateUpdateUser(user)
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
  const syncDataToESHandler = new SyncDataToESHandler(ESClient)
  return {
    messageData: workerDataInstance,
    prismaClient,
    syncDataToESHandler,
  }
}

const createOrUpdateMessageMapping = async (
  rawMsgContent: string,
  prismaClient: PrismaClient,
  userId: number,
  currentRawMappings: string,
  userSecretKey: string
): Promise<void> => {
  let encryptedMsgContent: string
  const symmetricEncryptor = new SymmetricEncryptor(EMsgEncryptionAlgorithms.AES_256_ECB)
  if (currentRawMappings) {
    const newMappings = new Set(currentRawMappings + rawMsgContent)
    encryptedMsgContent = symmetricEncryptor.encrypt(
      Array.from(newMappings).join(''),
      userSecretKey
    )
  } else {
    encryptedMsgContent = symmetricEncryptor.encrypt(rawMsgContent, userSecretKey)
  }
  // await prismaClient.messageMapping.update({
  //   where: {
  //     id,
  //   },
  //   data: {
  //     mappings: encryptedMsgContent,
  //   },
  // })
}

const encryptMessageContent = (
  rawMsgContent: string,
  msgEncryptor: UserMessageEncryptor
): string => {
  return msgEncryptor.encrypt(rawMsgContent)
}

const runWorker = async (workerData: SyncDataToESWorkerMessageDTO): Promise<void> => {
  console.log('launch worker 1: ', workerData)
  if (isMainThread) return
  console.log('launch worker 2')

  const { messageData, prismaClient, syncDataToESHandler } = await checkInputData(workerData)
  // const { type, data, msgEncryptor } = messageData
  const { type, data } = messageData

  // if (data && 'content' in data) {
  //   if (!msgEncryptor) {
  //     throw new WorkerInputDataException(ESyncDataToESMessages.SYNC_MESSAGE_ENCRYPTOR_NOT_FOUND)
  //   }
  //   const rawMsgContent = data.content
  //   await createOrUpdateMessageMapping(
  //     rawMsgContent,
  //     prismaClient,
  //     data.authorId,
  //     msgEncryptor.getMappings(),
  //     msgEncryptor.getSecretKey()
  //   )
  //   data.content = encryptMessageContent(rawMsgContent, msgEncryptor)
  // }

  switch (type) {
    case ESyncDataToESWorkerType.CREATE_MESSAGE:
      await syncDataToESHandler.recursiveCreateUpdateMessage(
        data as TMessageWithMedia,
        prismaClient
      )
      break
    case ESyncDataToESWorkerType.UPDATE_MESSAGE:
      await syncDataToESHandler.recursiveCreateUpdateMessage(
        data as TMessageWithMedia,
        prismaClient
      )
      break
    case ESyncDataToESWorkerType.DELETE_MESSAGE:
      await syncDataToESHandler.recursiveDeleteMessage(data as TMessage)
      break
    case ESyncDataToESWorkerType.CREATE_USER:
      await syncDataToESHandler.recursiveCreateUpdateUser(data as TUserWithProfile)
      break
    case ESyncDataToESWorkerType.UPDATE_USER:
      await syncDataToESHandler.recursiveCreateUpdateUser(data as TUserWithProfile)
      break
    case ESyncDataToESWorkerType.ALL_USERS_AND_MESSAGES:
      await syncDataToESHandler.recursiveSyncAllUsersAndMessages(prismaClient)
      break
    case ESyncDataToESWorkerType.DELETE_MESSAGES_IN_BULK:
      await syncDataToESHandler.recursiveDeleteMessagesInBulk(data as TMessage['id'][])
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
