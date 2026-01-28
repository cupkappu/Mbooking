import { Controller, Get, Post, Query, Body, UseGuards, NotFoundException, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery, ApiParam, ApiBadRequestResponse, ApiNotFoundResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { RatesService } from './services/rate.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('汇率')
@Controller('rates')
export class RatesController {
  constructor(private ratesService: RatesService) {}

  // ==================== 核心 API ====================

  @Get(':from/:to')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取最新汇率' })
  @ApiParam({ name: 'from', description: '源货币代码 (ISO 4217)', example: 'USD' })
  @ApiParam({ name: 'to', description: '目标货币代码 (ISO 4217)', example: 'CNY' })
  @ApiResponse({ status: 200, description: '成功返回汇率' })
  @ApiBadRequestResponse({ description: '缺少必需的货币代码参数' })
  @ApiNotFoundResponse({ description: '汇率不存在' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async getLatestRate(
    @Param('from') from: string,
    @Param('to') to: string,
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

  @Get(':from/:to/:date')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取指定日期的汇率' })
  @ApiParam({ name: 'from', description: '源货币代码', example: 'USD' })
  @ApiParam({ name: 'to', description: '目标货币代码', example: 'CNY' })
  @ApiParam({ name: 'date', description: '日期 (YYYY-MM-DD)', example: '2026-01-27' })
  @ApiResponse({ status: 200, description: '成功返回指定日期的汇率' })
  @ApiBadRequestResponse({ description: '日期格式无效' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async getRateAtDate(
    @Param('from') from: string,
    @Param('to') to: string,
    @Param('date') date: string,
  ) {
    const rate = await this.ratesService.getRateAtDate(from, to, date);
    
    if (!rate) {
      throw new NotFoundException(`Rate not found for ${from}/${to} on ${date}`);
    }
    
    return rate;
  }

  @Post('convert')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '货币转换' })
  @ApiResponse({ status: 200, description: '返回转换结果' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async convert(
    @Body() body: { amount: number; from: string; to: string; date?: string }
  ) {
    if (!body.from || !body.to) {
      throw new NotFoundException('Both "from" and "to" currency codes are required');
    }
    
    return this.ratesService.convert(body);
  }

  // ==================== 历史记录 ====================

  @Get(':from/:to/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取汇率历史' })
  @ApiParam({ name: 'from', description: '源货币代码' })
  @ApiParam({ name: 'to', description: '目标货币代码' })
  @ApiQuery({ name: 'fromDate', required: false, description: '开始日期' })
  @ApiQuery({ name: 'toDate', required: false, description: '结束日期' })
  @ApiQuery({ name: 'limit', required: false, description: '返回数量限制' })
  @ApiResponse({ status: 200, description: '返回历史记录' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async getRateHistory(
    @Param('from') from: string,
    @Param('to') to: string,
    @Query() query: { fromDate?: string; toDate?: string; limit?: string },
  ) {
    return this.ratesService.getRateHistory(from, to, query);
  }

  // ==================== 路径查询 ====================

  @Get(':from/:to/paths')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取可用转换路径' })
  @ApiParam({ name: 'from', description: '源货币代码' })
  @ApiParam({ name: 'to', description: '目标货币代码' })
  @ApiQuery({ name: 'date', required: false, description: '日期' })
  @ApiResponse({ status: 200, description: '返回可用路径' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async getAvailablePaths(
    @Param('from') from: string,
    @Param('to') to: string,
    @Query() query: { date?: string },
  ) {
    if (!from || !to) {
      throw new NotFoundException('Both "from" and "to" currency codes are required');
    }
    
    const paths = await this.ratesService.getAvailablePaths(from, to, query);
    
    return {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      paths,
      totalPaths: paths.length,
    };
  }

  // ==================== 手动汇率 ====================

  @Post('manual')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '设置手动汇率' })
  @ApiResponse({ status: 200, description: '设置成功' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async setManualRate(
    @Body() body: { from: string; to: string; rate: number; date?: string }
  ) {
    return this.ratesService.setManualRate(body);
  }

  // ==================== Provider 管理 ====================

  @Get('providers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取 Providers 列表' })
  @ApiResponse({ status: 200, description: '返回 Providers 列表' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async getProviders() {
    return this.ratesService.getProviders();
  }

  @Post('providers/:id/test')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '测试 Provider 连接' })
  @ApiParam({ name: 'id', description: 'Provider ID' })
  @ApiResponse({ status: 200, description: '测试结果' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async testProvider(@Param('id') id: string) {
    return this.ratesService.testProvider(id);
  }

  // ==================== 监控 API (新增) ====================

  @Get('stats/current')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前监控统计' })
  @ApiResponse({ status: 200, description: '返回当前小时的统计信息' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  getCurrentStats() {
    return this.ratesService.getCurrentStats();
  }

  @Get('stats/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取历史监控统计' })
  @ApiQuery({ name: 'from', required: false, description: '开始日期' })
  @ApiQuery({ name: 'to', required: false, description: '结束日期' })
  @ApiQuery({ name: 'limit', required: false, description: '返回数量限制' })
  @ApiResponse({ status: 200, description: '返回历史统计' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async getStatsHistory(
    @Query() query: { from?: string; to?: string; limit?: string },
  ) {
    return this.ratesService.getStatsHistory(query);
  }
}
