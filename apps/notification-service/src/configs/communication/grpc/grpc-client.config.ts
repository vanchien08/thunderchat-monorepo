import { EGrpcPackages } from '@/utils/enums';
import { ClientProviderOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

export class GrpcClientConfig {
  static getFriendClient(): ClientProviderOptions {
    return {
      name: EGrpcPackages.FRIEND_PACKAGE,
      transport: Transport.GRPC,
      options: {
        package: EGrpcPackages.FRIEND,
        protoPath: join(
          __dirname,
          '../../../../protos/artifacts/',
          'friend.proto',
        ),
        url: `localhost:${process.env.FRIEND_SERVICE_PORT}`,
      },
    };
  }

  static getConversationClient(): ClientProviderOptions {
    return {
      name: EGrpcPackages.CONVERSATION_PACKAGE,
      transport: Transport.GRPC,
      options: {
        package: EGrpcPackages.CONVERSATION,
        protoPath: join(
          __dirname,
          '../../../../protos/artifacts/',
          'conversation.proto',
        ),
        url: `localhost:${process.env.CONVERSATION_SERVICE_PORT}`,
      },
    };
  }

  static getAuthClient(): ClientProviderOptions {
    return {
      name: EGrpcPackages.AUTH_PACKAGE,
      transport: Transport.GRPC,
      options: {
        package: EGrpcPackages.AUTH,
        protoPath: join(
          __dirname,
          '/../../../../protos/artifacts/',
          'auth.proto',
        ),
        url: `localhost:${process.env.AUTH_SERVICE_PORT}`,
      },
    };
  }

  static getUserClient(): ClientProviderOptions {
    return {
      name: EGrpcPackages.USER_PACKAGE,
      transport: Transport.GRPC,
      options: {
        package: EGrpcPackages.USER,
        protoPath: join(
          __dirname,
          '/../../../../protos/artifacts/',
          'user.proto',
        ),
        url: `localhost:${process.env.USER_SERVICE_PORT}`,
      },
    };
  }

  static getNotificationClient(): ClientProviderOptions {
    return {
      name: EGrpcPackages.NOTIFICATION_PACKAGE,
      transport: Transport.GRPC,
      options: {
        package: EGrpcPackages.NOTIFICATION,
        protoPath: join(
          __dirname,
          '/../../../../protos/artifacts/',
          'notification.proto',
        ),
        url: `localhost:${process.env.NOTIFICATION_SERVICE_PORT}`,
      },
    };
  }
}
