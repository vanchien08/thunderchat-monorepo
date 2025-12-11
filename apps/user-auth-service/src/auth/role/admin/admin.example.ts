import { Controller, Get, UseGuards } from '@nestjs/common'
// import { AuthGuard } from '../../auth.guard'
import { AdminOnly } from './index'

// Ví dụ sử dụng AdminGuard
@Controller('example-admin')
// @UseGuards(AuthGuard, AdminGuard) // AuthGuard trước, AdminGuard sau
export class ExampleAdminController {
  // Route này chỉ admin mới truy cập được
  @Get('dashboard')
  @AdminOnly()
  async getAdminDashboard() {
    return { message: 'Admin dashboard data' }
  }

  // Route này không có @AdminOnly() nên user thường cũng truy cập được
  @Get('public')
  async getPublicData() {
    return { message: 'Public data' }
  }
}
