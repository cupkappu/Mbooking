import { Controller, Post, Get, Body, HttpCode, HttpStatus, Headers, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SetupService } from './setup.service';
import { InitializeSystemDto, InitializeSystemResponseDto, InitializationStatusDto } from './dto';

@ApiTags('setup')
@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check initialization status' })
  async getStatus(): Promise<InitializationStatusDto> {
    const status = await this.setupService.getStatus();
    return status;
  }

  @Post('initialize')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initialize system with admin user' })
  async initialize(
    @Body() dto: InitializeSystemDto,
    @Headers('x-init-secret') initSecret: string,
  ): Promise<InitializeSystemResponseDto> {
    // Validate INIT_SECRET at controller level for early rejection
    const expectedSecret = process.env.INIT_SECRET;
    if (!expectedSecret) {
      throw new ForbiddenException('Initialization secret not configured on server');
    }
    if (!initSecret || initSecret !== expectedSecret) {
      throw new ForbiddenException('Invalid or missing initialization secret');
    }

    return this.setupService.initialize(dto);
  }
}
