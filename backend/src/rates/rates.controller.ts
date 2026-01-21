import { Controller, Get, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RatesService } from './rates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('rates')
@Controller('rates')
export class RatesController {
  constructor(private ratesService: RatesService) {}

  @Get('latest')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get latest exchange rate' })
  async getLatestRate(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) {
      throw new NotFoundException('Both "from" and "to" currency codes are required');
    }
    
    const rate = await this.ratesService.getLatestRate(from, to);
    
    if (!rate) {
      throw new NotFoundException(
        `Exchange rate not available for ${from.toUpperCase()}/${to.toUpperCase()}. ` +
        'Please configure a rate provider in Admin > Providers.'
      );
    }
    
    return rate;
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get exchange rate history' })
  async getRateHistory(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
    @Query('limit') limit?: number,
  ) {
    return this.ratesService.getRateHistory(from, to, {
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('trend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get exchange rate trend' })
  async getRateTrend(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('days') days?: number,
  ) {
    return this.ratesService.getRateTrend(from, to, days ? Number(days) : 30);
  }

  @Get('convert')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Convert currency' })
  async convert(
    @Query('amount') amount: number,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) {
      throw new NotFoundException('Both "from" and "to" currency codes are required');
    }
    
    const result = await this.ratesService.convert(amount, from, to);
    
    if (!result) {
      throw new NotFoundException(
        `Exchange rate not available for ${from.toUpperCase()}/${to.toUpperCase()}. ` +
        'Please configure a rate provider in Admin > Providers.'
      );
    }
    
    return result;
  }

  @Get('paths')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all available conversion paths between currencies' })
  async getAvailablePaths(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) {
      throw new NotFoundException('Both "from" and "to" currency codes are required');
    }
    
    const paths = await this.ratesService.getAvailablePaths(from, to);
    
    return {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      paths,
      totalPaths: paths.length,
    };
  }
}
