import { EGrpcPackages } from '@/utils/enums'
import { ClientsProviderAsyncOptions, Transport } from '@nestjs/microservices'
import { join } from 'path'

export class GrpcClientConfig {
  static getFriendClient(): ClientsProviderAsyncOptions {
    return {
      name: EGrpcPackages.FRIEND_PACKAGE,
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package: EGrpcPackages.FRIEND,
          protoPath: join(__dirname, '/../../../../protos/artifacts/', 'friend.proto'),
          url: `localhost:${process.env.FRIEND_SERVICE_PORT}`,
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

  static getAuthClient(): ClientsProviderAsyncOptions {
    return {
      name: EGrpcPackages.AUTH_PACKAGE,
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package: EGrpcPackages.AUTH,
          protoPath: join(__dirname, '/../../../../protos/artifacts/', 'auth.proto'),
          url: `localhost:${process.env.AUTH_SERVICE_PORT}`,
        },
      }),
    }
  }

  static getUserClient(): ClientsProviderAsyncOptions {
    return {
      name: EGrpcPackages.USER_PACKAGE,
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package: EGrpcPackages.USER,
          protoPath: join(__dirname, '/../../../../protos/artifacts/', 'user.proto'),
          url: `localhost:${process.env.USER_SERVICE_PORT}`,
        },
      }),
    }
  }

  static getNotificationClient(): ClientsProviderAsyncOptions {
    return {
      name: EGrpcPackages.NOTIFICATION_PACKAGE,
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package: EGrpcPackages.NOTIFICATION,
          protoPath: join(__dirname, '/../../../../protos/artifacts/', 'notification.proto'),
          url: `localhost:${process.env.NOTIFICATION_SERVICE_PORT}`,
        },
      }),
    }
  }

  static getSearchClient(): ClientsProviderAsyncOptions {
    return {
      name: EGrpcPackages.SEARCH_PACKAGE,
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package: EGrpcPackages.SEARCH,
          protoPath: join(__dirname, '/../../../../protos/artifacts/', 'search.proto'),
          url: `localhost:${process.env.SEARCH_SERVICE_PORT}`,
        },
      }),
    }
  }
}
