export enum ERoutes {
  AUTH = 'auth',
  USER = 'user',
  DIRECT_CHAT = 'direct-chat',
  MESSAGE = 'message',
  FRIEND = 'friend',
  FRIEND_REQUEST = 'friend-request',
  HEALTHCHECK = 'healthcheck',
  STICKER = 'sticker',
  SEARCH = 'search',
  GROUP_CHAT = 'group-chat',
  GROUP_MEMBER = 'group-member',
  PROFILE = 'profile',
  PIN_CONVERSATION = 'pin-conversation',
  PUSH_NOTIFICATION = 'push-notification',
  UPLOAD = 'upload',
}

export enum EGrpcPackages {
  MEDIA_PACKAGE = 'MEDIA_PACKAGE',
  MEDIA = 'media',
  AUTH_PACKAGE = 'AUTH_PACKAGE',
  AUTH = 'auth',
  USER_CONNECTION_PACKAGE = 'USER_CONNECTION_PACKAGE',
  USER_CONNECTION = 'user_connection',
  UPLOAD_PACKAGE = 'UPLOAD_PACKAGE',
  UPLOAD = 'upload',
  ADMIN_PACKAGE = 'ADMIN_PACKAGE',
  ADMIN = 'admin',
}

export enum EGrpcServices {
  AUTH_SERVICE = 'AuthService',
  USER_CONNECTION_SERVICE = 'UserConnectionService',
  UPLOAD_SERVICE = 'UploadService',
}

export enum EClientCookieNames {
  JWT_TOKEN_AUTH = 'jwt_token_auth',
}

export enum ELengths {
  PASSWORD_MIN_LEN = 6,
}

export enum EProviderTokens {
  PRISMA_CLIENT = 'Prisma_Client_Provider',
}

export enum ECommonStatuses {
  SUCCESS = 'success',
  FAIL = 'fail',
  ERROR = 'error',
}

export enum EEnvironments {
  development = 'development',
  production = 'production',
}

export enum ESyncDataToESWorkerType {
  CREATE_MESSAGE = 'CREATE_MESSAGE',
  UPDATE_MESSAGE = 'UPDATE_MESSAGE',
  DELETE_MESSAGE = 'DELETE_MESSAGE',
  CREATE_USER = 'CREATE_USER',
  UPDATE_USER = 'UPDATE_USER',
  DELETE_USER = 'DELETE_USER',
  CREATE_PROFILE = 'CREATE_PROFILE',
  ALL_USERS_AND_MESSAGES = 'ALL_USERS_AND_MESSAGES',
  DELETE_MESSAGES_IN_BULK = 'DELETE_MESSAGES_IN_BULK',
}

export enum EWorkerEvents {
  ERROR = 'error',
  EXIT = 'exit',
  MESSAGE = 'message',
}

export enum EMsgEncryptionAlgorithms {
  AES_256_GCM = 'aes-256-gcm',
}

export enum EChatType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
}

export enum ESortTypes {
  TIME_ASC = 'ASC',
  TIME_DESC = 'DESC',
}

export enum EMessageStatus {
  SENT = 'SENT',
  SEEN = 'SEEN',
}

export enum EAppRoles {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum EGlobalMessages {
  UNKNOWN_FILE_TYPE = 'Unknown file type',
}

export enum EInternalEvents {
  CREATE_GROUP_CHAT = 'CREATE_GROUP_CHAT',
  ADD_MEMBERS_TO_GROUP_CHAT = 'ADD_MEMBERS_TO_GROUP_CHAT',
  REMOVE_GROUP_CHAT_MEMBERS = 'REMOVE_GROUP_CHAT_MEMBERS',
  UPDATE_GROUP_CHAT_INFO = 'UPDATE_GROUP_CHAT_INFO',
  UPDATE_USER_INFO = 'UPDATE_USER_INFO',
  DELETE_DIRECT_CHAT = 'DELETE_DIRECT_CHAT',
  DELETE_GROUP_CHAT = 'DELETE_GROUP_CHAT',
  MEMBER_LEAVE_GROUP_CHAT = 'MEMBER_LEAVE_GROUP_CHAT',
}

export enum EUserOnlineStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}
