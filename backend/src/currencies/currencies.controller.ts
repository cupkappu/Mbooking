import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { CurrenciesService } from './currencies.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('currencies')
@Controller('currencies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CurrenciesController {
  constructor(private currenciesService: CurrenciesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active currencies' })
  @ApiResponse({ status: 200, description: 'Returns all active currencies' })
  async findAll() {
    return this.currenciesService.findAll();
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get currency by code' })
  @ApiResponse({ status: 200, description: 'Returns the currency' })
  @ApiNotFoundResponse({ description: 'Currency not found' })
  async findOne(@Param('code') code: string) {
    return this.currenciesService.findByCode(code);
  }
}
