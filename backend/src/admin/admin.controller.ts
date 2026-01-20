import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminService, PaginationParams, LogQueryParams, BulkUserAction, SystemConfig, ExportParams } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateCurrencyDto, UpdateCurrencyDto } from '../currencies/dto/currency.dto';

import { Request } from 'express';
import { ProviderType } from '../rates/provider.entity';

type RequestWithIp = Request & { ip?: string; headers?: { [key: string]: string } };

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // =========================================================================
  // User Management
  // =========================================================================

  @Get('users')
  async listUsers(
    @Req() req: RequestWithIp,
    @Query('offset') offset?: number,
    @Query('limit') limit?: number,
  ) {
    const tenantId = (req as any).user?.tenant_id || 'system';
    const result = await this.adminService.listUsers(tenantId, { offset, limit });
    return { success: true, data: result };
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    const user = await this.adminService.getUser(id);
    return { success: true, data: user };
  }

  @Post('users')
  async createUser(
    @Req() req: RequestWithIp,
    @Body() body: { email: string; name: string; password: string; role: string },
  ) {
    // JWT strategy returns tenantId/userId (camelCase), not tenant_id/id (snake_case)
    const tenantId = (req as any).user?.tenantId || 'system';
    const adminId = (req as any).user?.userId || (req as any).user?.sub;
    const user = await this.adminService.createUser(
      tenantId,
      body,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, data: user };
  }

  @Put('users/:id')
  async updateUser(
    @Req() req: RequestWithIp,
    @Param('id') id: string,
    @Body() body: { email?: string; name?: string; role?: string; is_active?: boolean },
  ) {
    const adminId = (req as any).user?.id;
    const user = await this.adminService.updateUser(
      id,
      body,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, data: user };
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableUser(
    @Req() req: RequestWithIp,
    @Param('id') id: string,
  ) {
    const adminId = (req as any).user?.id;
    await this.adminService.disableUser(
      id,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
  }

  @Post('users/:id/reset-password')
  async resetPassword(
    @Req() req: RequestWithIp,
    @Param('id') id: string,
    @Body() body: { new_password: string },
  ) {
    const adminId = (req as any).user?.id;
    await this.adminService.resetPassword(
      id,
      body.new_password,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, message: 'Password reset successfully' };
  }

  @Post('users/bulk-action')
  async bulkUserAction(
    @Req() req: RequestWithIp,
    @Body() body: BulkUserAction,
  ) {
    const tenantId = (req as any).user?.tenant_id || 'system';
    const adminId = (req as any).user?.id;
    const result = await this.adminService.bulkUserAction(
      tenantId,
      body,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, data: result };
  }

  // =========================================================================
  // System Settings
  // =========================================================================

  @Get('system/config')
  async getSystemConfig() {
    const config = await this.adminService.getSystemConfig();
    return { success: true, data: config };
  }

  @Put('system/config')
  async updateSystemConfig(
    @Req() req: RequestWithIp,
    @Body() body: Partial<SystemConfig>,
  ) {
    const adminId = (req as any).user?.id;
    const config = await this.adminService.updateSystemConfig(
      body,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, data: config };
  }

  // =========================================================================
  // Provider Management
  // =========================================================================

  @Get('providers')
  async listProviders(
    @Query('offset') offset?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.adminService.listProviders({ offset, limit });
    return { success: true, data: result };
  }

  @Get('providers/:id')
  async getProvider(@Param('id') id: string) {
    const provider = await this.adminService.getProvider(id);
    return { success: true, data: provider };
  }

  @Post('providers')
  async createProvider(
    @Req() req: RequestWithIp,
    @Body() body: { name: string; type: ProviderType; config: any },
  ) {
    const adminId = (req as any).user?.id;
    const provider = await this.adminService.createProvider(
      body,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, data: provider };
  }

  @Put('providers/:id')
  async updateProvider(
    @Req() req: RequestWithIp,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const adminId = (req as any).user?.id;
    const provider = await this.adminService.updateProvider(
      id,
      body,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, data: provider };
  }

  @Delete('providers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProvider(
    @Req() req: RequestWithIp,
    @Param('id') id: string,
  ) {
    const adminId = (req as any).user?.id;
    await this.adminService.deleteProvider(
      id,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
  }

  @Post('providers/:id/toggle')
  async toggleProvider(
    @Req() req: RequestWithIp,
    @Param('id') id: string,
  ) {
    const adminId = (req as any).user?.id;
    const provider = await this.adminService.toggleProvider(
      id,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, data: provider };
  }

  @Post('providers/:id/test')
  async testProvider(
    @Req() req: RequestWithIp,
    @Param('id') id: string,
  ) {
    const adminId = (req as any).user?.id;
    const result = await this.adminService.testProvider(
      id,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: result.success, data: result };
  }

  // =========================================================================
  // Currency Management
  // =========================================================================

  @Get('currencies')
  async listCurrencies() {
    const currencies = await this.adminService.getAllCurrencies();
    return { success: true, data: currencies };
  }

  @Post('currencies')
  async createCurrency(
    @Req() req: RequestWithIp,
    @Body() body: CreateCurrencyDto,
  ) {
    const adminId = (req as any).user?.id;
    const currency = await this.adminService.createCurrency(
      body,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, data: currency };
  }

  @Put('currencies/:code')
  async updateCurrency(
    @Req() req: RequestWithIp,
    @Param('code') code: string,
    @Body() body: UpdateCurrencyDto,
  ) {
    const adminId = (req as any).user?.id;
    const currency = await this.adminService.updateCurrency(
      code,
      body,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, data: currency };
  }

  @Delete('currencies/:code')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCurrency(
    @Req() req: RequestWithIp,
    @Param('code') code: string,
  ) {
    const adminId = (req as any).user?.id;
    await this.adminService.deleteCurrency(
      code,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
  }

  @Post('currencies/seed')
  async seedCurrencies(@Req() req: RequestWithIp) {
    const adminId = (req as any).user?.id;
    const result = await this.adminService.seedCurrencies(
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, data: result, message: `${result.added} currencies added, ${result.skipped} skipped` };
  }

  // =========================================================================
  // Audit Logs
  // =========================================================================

  @Get('logs')
  async getAuditLogs(
    @Query('offset') offset?: number,
    @Query('limit') limit?: number,
    @Query('user_id') userId?: string,
    @Query('action') action?: string,
    @Query('entity_type') entityType?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    const result = await this.adminService.getAuditLogs({
      offset,
      limit,
      user_id: userId,
      action,
      entity_type: entityType,
      date_from: dateFrom,
      date_to: dateTo,
    });
    return { success: true, data: result };
  }

  @Get('logs/export')
  async exportAuditLogs(
    @Res() res: Response,
    @Query('user_id') userId?: string,
    @Query('action') action?: string,
    @Query('entity_type') entityType?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    const csv = await this.adminService.exportAuditLogsToCsv({
      user_id: userId,
      action,
      entity_type: entityType,
      date_from: dateFrom,
      date_to: dateTo,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');
    res.send(csv);
  }

  // =========================================================================
  // Data Export
  // =========================================================================

  @Post('export')
  async exportData(
    @Req() req: RequestWithIp,
    @Body() body: ExportParams,
  ) {
    const tenantId = (req as any).user?.tenant_id || 'system';
    const adminId = (req as any).user?.id;
    const result = await this.adminService.exportData(tenantId, body, adminId);

    if (body.format === 'json') {
      return { success: true, data: result };
    }

    return { success: true, data: result, message: 'Export initiated' };
  }

  // =========================================================================
  // Scheduler Control
  // =========================================================================

  @Get('scheduler/config')
  async getSchedulerConfig() {
    const config = await this.adminService.getSchedulerConfig();
    return { success: true, data: config };
  }

  @Put('scheduler/config')
  async updateSchedulerConfig(
    @Req() req: RequestWithIp,
    @Body() body: any,
  ) {
    const adminId = (req as any).user?.id;
    const config = await this.adminService.updateSchedulerConfig(
      body,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, data: config };
  }

  @Post('scheduler/fetch')
  async triggerManualFetch(
    @Req() req: RequestWithIp,
    @Body() body: { provider_ids?: string[]; currencies?: string[] },
  ) {
    const adminId = (req as any).user?.id;
    const result = await this.adminService.triggerManualFetch(
      adminId,
      body,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, data: result };
  }

  @Get('scheduler/history')
  async getSchedulerHistory() {
    const history = await this.adminService.getSchedulerHistory();
    return { success: true, data: history };
  }

  // =========================================================================
  // Plugin Management
  // =========================================================================

  @Get('plugins')
  async listPlugins() {
    const plugins = await this.adminService.listPlugins();
    return { success: true, data: plugins };
  }

  @Post('plugins')
  async uploadPlugin(
    @Req() req: RequestWithIp,
    @Body() body: { filename: string; content: string },
  ) {
    const adminId = (req as any).user?.id;
    const result = await this.adminService.uploadPlugin(
      body.content,
      body.filename,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, data: result };
  }

  @Post('plugins/:id/reload')
  async reloadPlugin(
    @Req() req: RequestWithIp,
    @Param('id') id: string,
  ) {
    const adminId = (req as any).user?.id;
    const result = await this.adminService.reloadPlugin(
      id,
      adminId,
      req.ip || req.headers?.['x-forwarded-for'],
    );
    return { success: true, data: result };
  }

  // =========================================================================
  // Health Monitoring
  // =========================================================================

  @Get('health')
  async getHealth() {
    const health = await this.adminService.getHealthStatus();
    return health;
  }
}
