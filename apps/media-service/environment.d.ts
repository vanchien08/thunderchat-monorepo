declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production'
      PORT: string
      GRPC_PORT: string
      HOST_ADDRESS: string
      DATABASE_URL: string
      AWS_ACCESS_KEY_ID: string
      AWS_SECRET_ACCESS_KEY: string
      AWS_REGION: string
      AWS_BUCKET_NAME: string
      AWS_ACCESS_KEY: string
      AWS_SECRET_KEY: string
      AWS_REGION: string
      AWS_S3_BUCKET: string
      CLIENT_HOST: string
      CLIENT_HOST_DEV: string
      SERVER_ENDPOINT: string
      MESSAGES_ENCRYPTION_SECRET_KEY: string
      MESSAGES_ENCRYPTION_VERSION_CODE: string
      SERVER_ENDPOINT_DEV: string
    }
  }
  namespace Express {
    interface Request {
      files?: TUploadedFile[]
    }
  }
}

export {}
