import { EGrpcPackages } from '@/utils/enums'
import { ClientsProviderAsyncOptions, Transport } from '@nestjs/microservices'
import { join } from 'path'

export class GrpcClientConfig {
  static getSearchClient(): ClientsProviderAsyncOptions {
    return {
      name: EGrpcPackages.SEARCH_PACKAGE,
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package: EGrpcPackages.SEARCH,
          protoPath: join(__dirname, '../../../../protos/artifacts/', 'search.proto'),
          url: `localhost:${process.env.SEARCH_SERVICE_PORT}`,
        },
      }),
    }
  }

  static getMediaClient(): ClientsProviderAsyncOptions {
    return {
      name: EGrpcPackages.MEDIA_PACKAGE,
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package: EGrpcPackages.MEDIA,
          protoPath: join(__dirname, '../../../../protos/artifacts/', 'media.proto'),
          url: `localhost:${process.env.MEDIA_SERVICE_PORT}`,
        },
      }),
    }
  }

  static getConversationClient(): ClientsProviderAsyncOptions {
    return {
      name: EGrpcPackages.CONVERSATION_PACKAGE,
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package: EGrpcPackages.CONVERSATION,
          protoPath: join(__dirname, '/../../../../protos/artifacts/', 'conversation.proto'),
          url: `localhost:${process.env.CONVERSATION_SERVICE_PORT}`,
        },
      }),
    }
  }

  static getChatClient(): ClientsProviderAsyncOptions {
    return {
      name: EGrpcPackages.CHAT_PACKAGE,
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package: EGrpcPackages.CHAT,
          protoPath: join(__dirname, '/../../../../protos/artifacts/', 'chat.proto'),
          url: `localhost:${process.env.CHAT_SERVICE_PORT}`,
        },
      }),
    }
  }
}
