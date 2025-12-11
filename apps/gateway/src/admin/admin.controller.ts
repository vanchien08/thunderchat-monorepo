import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  UseFilters,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common'
import { AdminService } from './admin.service'
import { AuthGuard } from '@/auth/auth.guard'
import { User } from '@/user/user.decorator'
import { AdminExceptionFilter } from './admin.exception-filter'
import {
  GetAdminUsersDTO,
  LockUnlockUserDTO,
  DeleteUserDTO,
  UpdateUserEmailDTO,
  GetViolationReportsDTO,
  GetViolationReportDetailDTO,
  UpdateViolationReportStatusDTO,
  BanReportedUserDTO,
  GetUserReportHistoryDTO,
} from './admin.dto'
import { AdminGuard } from './admin.guard'
import { AdminOnly } from './admin.decorator'
import { BanUserDTO, GetSystemOverviewDTO, GetUserMessageStatsDTO } from './admin.dto'

@Controller('admin')
@UseGuards(AuthGuard)
@UseFilters(AdminExceptionFilter)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getUsers(@Query() query: GetAdminUsersDTO) {
    return this.adminService.getUsers(query)
  }

  @Get('overview')
  @AdminOnly()
  async getSystemOverview(@Query() params: GetSystemOverviewDTO) {
    return await this.adminService.getSystemOverview(params)
  }
  @Put('users/:userId/lock')
  async lockUnlockUser(@Param('userId') userId: string, @Body() body: LockUnlockUserDTO) {
    return this.adminService.lockUnlockUser(parseInt(userId), body.isActive)
  }

  @Put('users/:userId/email')
  async updateUserEmail(@Param('userId') userId: string, @Body() body: UpdateUserEmailDTO) {
    return this.adminService.updateUserEmail(parseInt(userId), body.email)
  }

  // Violation Reports Endpoints
  @Get('violation-reports')
  async getViolationReports(@Query() query: GetViolationReportsDTO) {
    return this.adminService.getViolationReports({
      page: query.page || 1,
      limit: query.limit || 10,
      search: query.search,
      status: query.status || 'ALL',
      category: query.category || 'ALL',
      startDate: query.startDate,
      endDate: query.endDate,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    })
  }

  @Get('violation-reports/:reportId')
  async getViolationReportDetail(@Param() params: GetViolationReportDetailDTO) {
    return this.adminService.getViolationReportDetail(params.reportId)
  }

  @Put('violation-reports/:reportId/status')
  async updateViolationReportStatus(
    @Param('reportId') reportId: string,
    @Body() body: UpdateViolationReportStatusDTO
  ) {
    return this.adminService.updateViolationReportStatus(parseInt(reportId), body.status)
  }

  @Post('violation-reports/:reportId/ban-user')
  async banReportedUser(@Param('reportId') reportId: string, @Body() body: BanReportedUserDTO) {
    return this.adminService.banReportedUser(
      parseInt(reportId),
      body.banType,
      body.reason,
      body.banDuration,
      body.bannedUntil,
      body.messageIds
    )
  }

  @Get('users/:userId/report-history')
  @UseGuards(AuthGuard, AdminGuard)
  @AdminOnly()
  async getUserReportHistory(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: GetUserReportHistoryDTO
  ) {
    const result = await this.adminService.getUserReportHistory({
      userId,
      type: query.type,
      page: query.page,
      limit: query.limit,
    })

    if (!result.success) {
      throw new BadRequestException(result.message)
    }

    return result.data
  }

  @Get('users/message-stats')
  @AdminOnly()
  async getUserMessageStats(@Query() params: GetUserMessageStatsDTO) {
    return await this.adminService.getUserMessageStats(params)
  }
}
