import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateTenantSettingsDto } from './dto/tenant-settings.dto';

@ApiTags('tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current tenant' })
  async getCurrent(@Request() req) {
    return this.tenantsService.findByUserId(req.user.userId);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update tenant settings' })
  async updateSettings(@Request() req, @Body() updateSettingsDto: UpdateTenantSettingsDto) {
    const tenant = await this.tenantsService.findByUserId(req.user.userId);
    return this.tenantsService.update(tenant.id, { settings: updateSettingsDto });
  }
}
