# User-Auth-Service

## Mô tả

Service tổng hợp gộp 3 microservices: **User**, **Auth**, và **Friend** vào một service duy nhất để đơn giản hóa kiến trúc và giảm độ phức tạp của inter-service communication.

## Tính năng

- ✅ **User Management**: Đăng ký, quản lý user, profile, user settings, block user, report
- ✅ **Authentication & Authorization**: Login, JWT token, password reset, admin role
- ✅ **Friend Management**: Friend requests, friend list, remove friend

## Công nghệ

- **Framework**: NestJS
- **Database**: PostgreSQL + Prisma ORM
- **gRPC**: Multiple packages (user, auth, friend) trên cùng một port
- **HTTP**: REST API với prefix `/api`

## Cấu hình

### Environment Variables (.env)

```env
PORT=4001                    # HTTP server port
GRPC_PORT=50054             # gRPC server port
HOST_ADDRESS=localhost
NODE_ENV=development

DATABASE_URL="postgresql://user:password@localhost:5432/user_auth_db?schema=public"

JWT_SECRET=your_secret_key
JWT_TOKEN_MAX_AGE_IN_HOUR=24h

CLIENT_HOST=http://localhost:3000
CLIENT_DOMAIN=localhost
```

## Cài đặt

### 1. Install dependencies

```bash
pnpm install
```

### 2. Setup Database

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev
```

### 3. Run Development

```bash
pnpm start:dev
```

## Servers

### HTTP Server

- **Port**: 4001
- **Base URL**: `http://localhost:4001/api`
- **Routes**:
  - `/api/user/*` - User endpoints
  - `/api/auth/*` - Authentication endpoints
  - `/api/friend/*` - Friend endpoints
  - `/api/friend-request/*` - Friend request endpoints
  - `/api/profile/*` - Profile endpoints

### gRPC Server

- **Port**: 50054
- **Packages**:
  - `user` - User service RPC methods
  - `auth` - Auth service RPC methods
  - `friend` - Friend service RPC methods

## Kiến trúc

### Module Structure

```
src/
├── main.ts                          # Entry point với HTTP + gRPC servers
├── app.module.ts                    # Root module
├── user/                            # User module
│   ├── user.controller.ts           # HTTP endpoints
│   ├── user-grpc.controller.ts      # gRPC methods
│   ├── user.service.ts
│   ├── user-settings/
│   └── user-report/
├── auth/                            # Auth module
│   ├── auth.controller.ts           # HTTP endpoints
│   ├── auth-grpc.controller.ts      # gRPC methods
│   ├── auth.service.ts
│   ├── jwt/
│   ├── credentials/
│   └── role/
├── friend/                          # Friend module
│   ├── friend.controller.ts         # HTTP endpoints
│   ├── friend-grpc.controller.ts    # gRPC methods
│   └── friend.service.ts
├── friend-request/                  # Friend request module
│   ├── friend-request.controller.ts
│   └── friend-request.service.ts
├── profile/                         # Profile module
├── configs/                         # Configuration modules
│   ├── db/                         # Prisma
│   └── logger/                     # Logger
└── utils/                          # Shared utilities
```

### gRPC Integration

Service này chạy multiple gRPC packages trên cùng một port (50054):

```typescript
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.GRPC,
  options: {
    package: ['user', 'auth', 'friend'],
    protoPath: [
      'protos/artifacts/user.proto',
      'protos/artifacts/auth.proto',
      'protos/artifacts/friend.proto',
    ],
    url: 'localhost:50054',
  },
})
```

## So sánh với kiến trúc cũ

### Trước (3 services riêng biệt)

```
user-service:4001 + gRPC:50051
auth-service:4002 + gRPC:50052
friendship-service:4003 + gRPC:50053
```

- ❌ Phức tạp hơn trong việc quản lý
- ❌ Cần gRPC client để giao tiếp giữa các services
- ❌ Network overhead cho inter-service calls

### Sau (1 service tổng hợp)

```
user-auth-service:4001 + gRPC:50054
```

- ✅ Đơn giản hơn, dễ maintain
- ✅ Direct dependency injection thay vì gRPC calls
- ✅ Giảm network latency
- ✅ Shared database connection pool

## Lưu ý

- Service này sử dụng `forwardRef()` để giải quyết circular dependencies giữa UserModule và AuthModule
- ElasticSearch integration đã được comment out (TODO: integrate khi cần)
- Cần install dependencies trước khi chạy: `pnpm install`
- Database URL phải được cấu hình đúng trong file `.env`

## Commands hữu ích

```bash
# Development
pnpm start:dev

# Build
pnpm build

# Production
pnpm start:prod

# Prisma commands
npx prisma studio          # Open Prisma Studio
npx prisma migrate dev     # Create new migration
npx prisma generate        # Generate Prisma Client
```

## License

UNLICENSED
