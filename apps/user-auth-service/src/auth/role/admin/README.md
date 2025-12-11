# Admin Authentication System

## Tổng quan

Hệ thống xác thực admin được xây dựng trên nền tảng authentication hiện có, với các tính năng bổ sung để kiểm tra quyền admin.

## Các thành phần

### 1. Admin Decorator

```typescript
// src/auth/role/admin/admin.decorator.ts
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true)
```

### 2. Admin Guard

```typescript
// src/auth/role/admin/admin.guard.ts
@Injectable()
export class AdminGuard implements CanActivate {
  // Kiểm tra quyền admin
}
```

### 3. Admin Login Service

```typescript
// src/auth/auth.service.ts
async loginAdmin(res: Response, { email, password }: TLoginUserParams): Promise<void>
```

## Cách sử dụng

### 1. Kiểm tra Email Admin (MỚI)

**API này giúp kiểm tra email có quyền admin hay không trước khi cho phép truy cập trang đăng nhập admin**

```bash
POST /api/auth/admin/check-email
Content-Type: application/json

{
  "email": "admin@example.com"
}
```

**Response khi email có quyền admin:**

```json
{
  "isAdmin": true
}
```

**Response khi email không có quyền admin:**

```json
{
  "isAdmin": false,
  "message": "Admin access required"
}
```

**Response khi email không tồn tại:**

```json
{
  "isAdmin": false,
  "message": "Admin not found"
}
```

### 2. Admin Login

```bash
POST /api/auth/admin/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "adminpassword"
}
```

**Response:**

```json
{
  "success": true
}
```

### 3. Kiểm tra quyền admin

```bash
GET /api/auth/admin/check-auth
```

**Response:**

```json
{
  "id": 1,
  "email": "admin@example.com",
  "role": "ADMIN",
  "Profile": { ... }
}
```

### 4. Admin Logout

```bash
POST /api/auth/admin/logout
```

**Response:**

```json
{
  "success": true
}
```

**Lưu ý:** API này chỉ cho phép admin logout. Nếu user không có quyền admin, sẽ trả về lỗi `ADMIN_ACCESS_REQUIRED`.

### 5. Bảo vệ routes admin

```typescript
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  @Get('dashboard')
  @AdminOnly()
  async getDashboard() {
    return { message: 'Admin dashboard' }
  }
}
```

## Luồng hoạt động

### Luồng cũ (có vấn đề):

1. **User nhập email** → Hệ thống cho phép truy cập trang đăng nhập admin
2. **User nhập password** → Hệ thống mới kiểm tra quyền admin
3. **Nếu không phải admin** → Báo lỗi sau khi đã nhập password

### Luồng mới (đã sửa):

1. **User nhập email** → Gọi API `/api/auth/admin/check-email`
2. **Hệ thống kiểm tra email có quyền admin không**
3. **Nếu có quyền admin** → Cho phép truy cập trang đăng nhập admin
4. **Nếu không có quyền admin** → Báo lỗi ngay lập tức, không cho truy cập
5. **User nhập password** → Chỉ những admin mới được nhập password
6. **Admin logout** → Gọi API `/api/auth/admin/logout` để đăng xuất an toàn

## Error Messages

- `ADMIN_ACCESS_REQUIRED`: User không có quyền admin
- `USER_NOT_AUTHENTICATED`: User chưa đăng nhập
- `INVALID_ADMIN_CREDENTIALS`: Thông tin đăng nhập admin không hợp lệ
- `ADMIN_NOT_FOUND`: Email không tồn tại trong hệ thống

## Ví dụ sử dụng trong Frontend

```javascript
// Kiểm tra email admin trước khi hiển thị form đăng nhập admin
async function checkAdminEmail(email) {
  try {
    const response = await fetch('/api/auth/admin/check-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    const result = await response.json()

    if (result.isAdmin) {
      // Hiển thị form đăng nhập admin
      showAdminLoginForm()
    } else {
      // Hiển thị thông báo lỗi
      showError(result.message)
    }
  } catch (error) {
    console.error('Error checking admin email:', error)
  }
}
```
