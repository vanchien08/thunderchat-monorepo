declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      PORT: string;
      DATABASE_URL: string;
      AWS_ACCESS_KEY_ID: string;
      AWS_SECRET_ACCESS_KEY: string;
      AWS_REGION: string;
      AWS_BUCKET_NAME: string;
      AWS_ACCESS_KEY: string;
      AWS_SECRET_KEY: string;
      AWS_REGION: string;
      AWS_S3_BUCKET: string;
      CLIENT_HOST: string;
      CLIENT_HOST_DEV: string;
      VAPID_PUBLIC_KEY: string;
    }
  }
}

export {};
