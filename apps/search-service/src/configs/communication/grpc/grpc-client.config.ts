import { EGrpcPackages } from '@/utils/enums'
import { ClientProviderOptions, Transport } from '@nestjs/microservices'
import { join } from 'path'

export class GrpcClientConfig {
  static getChatClient(): ClientProviderOptions {
    return {
      name: EGrpcPackages.CHAT_PACKAGE,
      transport: Transport.GRPC,
      options: {
        package: EGrpcPackages.CHAT,
        protoPath: join(__dirname, '/../../../../protos/artifacts/', 'chat.proto'),
        url: `localhost:${process.env.CHAT_SERVICE_PORT}`,
      },
    }
  }

  static getConversationClient(): ClientProviderOptions {
    return {
      name: EGrpcPackages.CONVERSATION_PACKAGE,
      transport: Transport.GRPC,
      options: {
        package: EGrpcPackages.CONVERSATION,
        protoPath: join(__dirname, '/../../../../protos/artifacts/', 'conversation.proto'),
        url: `localhost:${process.env.CONVERSATION_SERVICE_PORT}`,
      },
    }
  }

  static getUserClient(): ClientProviderOptions {
    return {
      name: EGrpcPackages.USER_PACKAGE,
      transport: Transport.GRPC,
      options: {
        package: EGrpcPackages.USER,
        protoPath: join(__dirname, '/../../../../protos/artifacts/', 'user.proto'),
        url: `localhost:${process.env.USER_SERVICE_PORT}`,
      },
    }
  }
}
