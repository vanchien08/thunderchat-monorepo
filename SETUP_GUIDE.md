# Hướng Dẫn Setup Monorepo cho Render Deployment

## Tổng quan

Chuyển đổi từ 2 repo riêng biệt (thunderchat-server + thunderchat-server-ms) thành 1 monorepo để deploy lên Render với chi phí thấp.

**Cấu trúc cuối:**

```
thunderchat-monorepo/
├── apps/
│   ├── gateway/              # từ thunderchat-server
│   ├── user-auth-service/    # từ thunderchat-server-ms/user-auth-service
│   ├── chat-service/         # từ thunderchat-server-ms/chat-service
│   ├── call-service/         # từ thunderchat-server-ms/call-service
│   ├── search-service/       # từ thunderchat-server-ms/search-service
│   ├── notification-service/ # từ thunderchat-server-ms/notification_service
│   ├── conversation-service/ # từ thunderchat-server-ms/conversation-service
│   ├── media-service/        # từ thunderchat-server-ms/media-service
│   └── admin-service/        # từ thunderchat-server-ms/admin-service
├── package.json              # Root package.json
├── pnpm-workspace.yaml       # PNPM workspaces config
└── render.yaml               # Config cho Render
```

---

## Bước 1: Tạo folder structure

```powershell
# Tạo folder apps nếu chưa có
cd f:\DO_ANTN\CLONE\thunderchat-monorepo
mkdir apps -Force
```

---

## Bước 2: Copy Gateway (thunderchat-server)

```powershell
# Copy toàn bộ thunderchat-server vào apps/gateway
xcopy /E /I /H /Y f:\DO_ANTN\CLONE\thunderchat-server f:\DO_ANTN\CLONE\thunderchat-monorepo\apps\gateway

# Xóa các folder không cần thiết trong gateway
cd f:\DO_ANTN\CLONE\thunderchat-monorepo\apps\gateway
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .git -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
```

---

## Bước 3: Copy 8 Microservices

```powershell
cd f:\DO_ANTN\CLONE\thunderchat-server-ms

# Copy từng service
xcopy /E /I /H /Y user-auth-service f:\DO_ANTN\CLONE\thunderchat-monorepo\apps\user-auth-service
xcopy /E /I /H /Y chat-service f:\DO_ANTN\CLONE\thunderchat-monorepo\apps\chat-service
xcopy /E /I /H /Y call-service f:\DO_ANTN\CLONE\thunderchat-monorepo\apps\call-service
xcopy /E /I /H /Y search-service f:\DO_ANTN\CLONE\thunderchat-monorepo\apps\search-service
xcopy /E /I /H /Y notification_service f:\DO_ANTN\CLONE\thunderchat-monorepo\apps\notification-service
xcopy /E /I /H /Y conversation-service f:\DO_ANTN\CLONE\thunderchat-monorepo\apps\conversation-service
xcopy /E /I /H /Y media-service f:\DO_ANTN\CLONE\thunderchat-monorepo\apps\media-service
xcopy /E /I /H /Y admin-service f:\DO_ANTN\CLONE\thunderchat-monorepo\apps\admin-service

# Xóa node_modules, .git, dist trong tất cả services
cd f:\DO_ANTN\CLONE\thunderchat-monorepo\apps
Get-ChildItem -Directory | ForEach-Object {
    Remove-Item -Recurse -Force "$($_.FullName)\node_modules" -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force "$($_.FullName)\.git" -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force "$($_.FullName)\dist" -ErrorAction SilentlyContinue
}
```

---

## Bước 4: Tạo Root package.json

Tạo file `f:\DO_ANTN\CLONE\thunderchat-monorepo\package.json`:

```json
{
  "name": "thunderchat-monorepo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build:gateway": "pnpm --filter gateway build",
    "build:user-auth": "pnpm --filter user-auth-service build",
    "build:chat": "pnpm --filter chat-service build",
    "build:call": "pnpm --filter call-service build",
    "build:search": "pnpm --filter search-service build",
    "build:notification": "pnpm --filter notification-service build",
    "build:conversation": "pnpm --filter conversation-service build",
    "build:media": "pnpm --filter media-service build",
    "build:admin": "pnpm --filter admin-service build",
    "build:all": "pnpm -r build",
    "start:gateway": "pnpm --filter gateway start:prod",
    "start:user-auth": "pnpm --filter user-auth-service start:prod",
    "start:chat": "pnpm --filter chat-service start:prod",
    "start:call": "pnpm --filter call-service start:prod",
    "start:search": "pnpm --filter search-service start:prod",
    "start:notification": "pnpm --filter notification-service start:prod",
    "start:conversation": "pnpm --filter conversation-service start:prod",
    "start:media": "pnpm --filter media-service start:prod",
    "start:admin": "pnpm --filter admin-service start:prod"
  },
  "devDependencies": {
    "turbo": "^2.3.3"
  }
}
```

---

## Bước 5: Tạo pnpm-workspace.yaml

Tạo file `f:\DO_ANTN\CLONE\thunderchat-monorepo\pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
```

---

## Bước 6: Update package.json của từng service

Mỗi service cần có script `start:prod` trong `package.json`:

```json
{
  "name": "gateway",
  "scripts": {
    "build": "nest build",
    "start:prod": "node dist/main.js"
  }
}
```

**Lặp lại cho tất cả 9 apps** (gateway + 8 services).

---

## Bước 7: Tạo render.yaml

Tạo file `f:\DO_ANTN\CLONE\thunderchat-monorepo\render.yaml`:

```yaml
services:
  # Gateway
  - type: web
    name: thunderchat-gateway
    runtime: node
    buildCommand: pnpm install && pnpm build:gateway
    startCommand: pnpm start:gateway
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: USER_AUTH_SERVICE_URL
        value: https://thunderchat-user-auth.onrender.com
      - key: CHAT_SERVICE_URL
        value: https://thunderchat-chat.onrender.com
      - key: CALL_SERVICE_URL
        value: https://thunderchat-call.onrender.com
      - key: SEARCH_SERVICE_URL
        value: https://thunderchat-search.onrender.com
      - key: NOTIFICATION_SERVICE_URL
        value: https://thunderchat-notification.onrender.com
      - key: CONVERSATION_SERVICE_URL
        value: https://thunderchat-conversation.onrender.com
      - key: MEDIA_SERVICE_URL
        value: https://thunderchat-media.onrender.com
      - key: ADMIN_SERVICE_URL
        value: https://thunderchat-admin.onrender.com

  # User Auth Service
  - type: web
    name: thunderchat-user-auth
    runtime: node
    buildCommand: pnpm install && pnpm build:user-auth
    startCommand: pnpm start:user-auth
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false

  # Chat Service
  - type: web
    name: thunderchat-chat
    runtime: node
    buildCommand: pnpm install && pnpm build:chat
    startCommand: pnpm start:chat
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false

  # Call Service
  - type: web
    name: thunderchat-call
    runtime: node
    buildCommand: pnpm install && pnpm build:call
    startCommand: pnpm start:call
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false
      - key: AGORA_APP_ID
        sync: false
      - key: AGORA_APP_CERTIFICATE
        sync: false

  # Search Service
  - type: web
    name: thunderchat-search
    runtime: node
    buildCommand: pnpm install && pnpm build:search
    startCommand: pnpm start:search
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false
      - key: OPENAI_API_KEY
        sync: false

  # Notification Service
  - type: web
    name: thunderchat-notification
    runtime: node
    buildCommand: pnpm install && pnpm build:notification
    startCommand: pnpm start:notification
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false

  # Conversation Service
  - type: web
    name: thunderchat-conversation
    runtime: node
    buildCommand: pnpm install && pnpm build:conversation
    startCommand: pnpm start:conversation
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false

  # Media Service
  - type: web
    name: thunderchat-media
    runtime: node
    buildCommand: pnpm install && pnpm build:media
    startCommand: pnpm start:media
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false
      - key: AWS_ACCESS_KEY_ID
        sync: false
      - key: AWS_SECRET_ACCESS_KEY
        sync: false
      - key: AWS_S3_BUCKET
        sync: false

  # Admin Service
  - type: web
    name: thunderchat-admin
    runtime: node
    buildCommand: pnpm install && pnpm build:admin
    startCommand: pnpm start:admin
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false

databases:
  - name: thunderchat-db
    databaseName: thunderchat
    user: thunderchat
    plan: starter
```

---

## Bước 8: Install dependencies

```powershell
cd f:\DO_ANTN\CLONE\thunderchat-monorepo
pnpm install
```

---

## Bước 9: Test build locally

```powershell
# Test build tất cả services
pnpm build:all

# Test build từng service
pnpm build:gateway
pnpm build:user-auth
pnpm build:chat
# ... các service khác
```

---

## Bước 10: Push lên GitHub

```powershell
cd f:\DO_ANTN\CLONE\thunderchat-monorepo
git init
git add .
git commit -m "Initial monorepo setup for Render deployment"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

---

## Bước 11: Deploy lên Render

### Cách 1: Dùng render.yaml (Recommended)

1. Đăng nhập [Render.com](https://render.com)
2. Click **New > Blueprint**
3. Chọn repo `thunderchat-monorepo`
4. Render sẽ tự động đọc `render.yaml` và tạo tất cả services
5. Thêm environment variables cho từng service qua dashboard

### Cách 2: Manual (từng service)

1. **New > Web Service** (làm 9 lần)
2. Config mỗi service:
   - **Name**: `thunderchat-gateway`, `thunderchat-user-auth`, ...
   - **Build Command**: `pnpm install && pnpm build:<service-name>`
   - **Start Command**: `pnpm start:<service-name>`
   - **Environment Variables**: Thêm theo từng service

---

## Bước 12: Config Database

1. **New > PostgreSQL**
2. Copy `DATABASE_URL`
3. Paste vào environment variables của **TẤT CẢ** services

---

## Bước 13: Verify

1. Kiểm tra logs của từng service
2. Test API endpoints:
   ```bash
   curl https://thunderchat-gateway.onrender.com/health
   curl https://thunderchat-user-auth.onrender.com/health
   curl https://thunderchat-chat.onrender.com/health
   ```

---

## Chi phí ước tính (Render)

| Service      | Instance Type | Chi phí/tháng |
| ------------ | ------------- | ------------- |
| Gateway      | Starter       | $7            |
| User Auth    | Starter       | $7            |
| Chat         | Starter       | $7            |
| Call         | Starter       | $7            |
| Search       | Starter       | $7            |
| Notification | Starter       | $7            |
| Conversation | Starter       | $7            |
| Media        | Starter       | $7            |
| Admin        | Starter       | $7            |
| PostgreSQL   | Starter       | $7            |
| **Tổng**     |               | **$70/tháng** |

### Tối ưu chi phí:

- **Dùng Free Tier**: Services ít traffic → Free ($0) nhưng spin down sau 15 phút idle
- **Merge services**: Gộp admin + notification → 1 service → giảm xuống ~$63/tháng
- **Dùng external DB**: Supabase, Neon.tech (free tier) → giảm $7

---

## Troubleshooting

### Lỗi: `Cannot find module`

**Nguyên nhân**: Import paths sai  
**Giải pháp**: Kiểm tra `tsconfig.json` paths và đảm bảo build đúng folder `dist/`

### Lỗi: `ECONNREFUSED` khi services gọi nhau

**Nguyên nhân**: Service URLs chưa đúng  
**Giải pháp**: Dùng internal URLs: `http://service-name:10000` thay vì external

### Lỗi: Build timeout

**Nguyên nhân**: `pnpm install` quá lâu  
**Giải pháp**: Thêm `.npmrc`:

```
shamefully-hoist=true
strict-peer-dependencies=false
```

---

## Next Steps

1. ✅ Setup CI/CD với GitHub Actions
2. ✅ Add monitoring (Sentry, LogRocket)
3. ✅ Setup health checks cho từng service
4. ✅ Add rate limiting
5. ✅ Setup Redis cho caching (optional)

---

**Hoàn thành!** Giờ bạn có 1 monorepo deploy được lên Render với 9 services riêng biệt.
