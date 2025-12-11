declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production'
    PORT: string
    GRPC_PORT: string
    HOST_ADDRESS: string
    DATABASE_URL: string
    JWT_SECRET: string
    JWT_TOKEN_MAX_AGE_IN_HOUR: string
    CLIENT_HOST: string
    CLIENT_HOST_DEV: string
    CLIENT_DOMAIN: string
    CLIENT_DOMAIN_DEV: string
    AUTH_SERVICE_PORT: string
    USER_SERVICE_PORT: string
    FRIEND_SERVICE_PORT: string
    CHAT_SERVICE_PORT: string
    SEARCH_SERVICE_PORT: string
    MEDIA_SERVICE_PORT: string
    CONVERSATION_SERVICE_PORT: string
  }
}
