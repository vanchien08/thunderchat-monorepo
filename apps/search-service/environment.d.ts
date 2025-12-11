declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production'
      PORT: string
      GRPC_PORT: string
      HOST_ADDRESS: string
      CHAT_SERVICE_PORT: string
      CONVERSATION_SERVICE_PORT: string
      USER_SERVICE_PORT: string
      DATABASE_URL: string
      CLIENT_HOST: string
      CLIENT_HOST_DEV: string
      ELASTIC_API_KEY: string
      ELASTICSEARCH_URL: string
      MESSAGE_MAPPINGS_VERSION_CODE: string
      MESSAGE_MAPPINGS_SECRET_KEY: string
      MESSAGES_ENCRYPTION_SECRET_KEY: string
    }
  }
}

export {}
