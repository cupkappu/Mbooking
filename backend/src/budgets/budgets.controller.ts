import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam, ApiQuery, ApiBadRequestResponse, ApiNotFoundResponse, ApiUnauthorizedResponse, ApiNoContentResponse } from '@nestjs/swagger';
import { BudgetsService, BudgetListParams } from './budgets.service';
import { BudgetAlertService } from './budget-alert.service';
import { BudgetTemplateService } from './budget-template.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { VarianceQueryDto } from './dto/variance-report.dto';
import { MultiCurrencySummaryQueryDto } from './dto/multi-currency-summary.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('预算')
@Controller('budgets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BudgetsController {
  constructor(
    private budgetsService: BudgetsService,
    private alertService: BudgetAlertService,
    private templateService: BudgetTemplateService,
  ) {}

  // Alert Management Endpoints

  @Get('alerts')
  @ApiOperation({ summary: '获取预算告警列表' })
  @ApiQuery({ name: 'status', required: false, description: '告警状态过滤', example: 'pending' })
  @ApiQuery({ name: 'budget_id', required: false, description: '预算ID过滤', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量', example: 20 })
  @ApiResponse({ status: 200, description: '成功返回告警列表（分页）' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async getAlerts(
    @Query('status') status?: 'pending' | 'sent' | 'acknowledged' | 'dismissed',
    @Query('budget_id') budget_id?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.alertService.listAlerts(
      undefined, // tenantId will be extracted from context
      {
        status: status as any,
        budgetId: budget_id,
        offset: page ? (page - 1) * (limit || 20) : 0,
        limit: limit || 20,
      }
    );
    return {
      data: result.alerts,
      total: result.total,
      page: page || 1,
      limit: limit || 20,
      total_pages: Math.ceil(result.total / (limit || 20)),
    };
  }

  @Get('alerts/count')
  @ApiOperation({ summary: '获取待处理告警数量' })
  @ApiResponse({ status: 200, description: '返回待处理告警数量' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async getAlertCount() {
    const stats = await this.alertService.getAlertStats(undefined); // tenantId will be extracted
    return { count: stats.pending };
  }

  @Post('alerts/:id/acknowledge')
  @ApiOperation({ summary: '确认告警' })
  @ApiParam({ name: 'id', description: '告警ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: '告警确认成功' })
  @ApiNotFoundResponse({ description: '告警不存在' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async acknowledgeAlert(@Param('id') id: string) {
    // TODO: Get userId from auth context
    return this.alertService.acknowledgeAlert(id, 'system');
  }

  @Post('alerts/:id/dismiss')
  @ApiOperation({ summary: '忽略告警' })
  @ApiParam({ name: 'id', description: '告警ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: '告警忽略成功' })
  @ApiNotFoundResponse({ description: '告警不存在' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async dismissAlert(@Param('id') id: string) {
    // TODO: Get userId from auth context
    return this.alertService.dismissAlert(id, 'system');
  }

  // Template Management Endpoints

  @Get('templates')
  @ApiOperation({ summary: '获取预算模板列表' })
  @ApiQuery({ name: 'category', required: false, description: '模板类别过滤', example: 'personal' })
  @ApiQuery({ name: 'include_system', required: false, description: '是否包含系统模板', example: true })
  @ApiQuery({ name: 'search', required: false, description: '搜索关键词', example: 'monthly' })
  @ApiResponse({ status: 200, description: '成功返回模板列表' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async getTemplates(
    @Query('category') category?: string,
    @Query('include_system') include_system?: string,
    @Query('search') search?: string,
  ) {
    return this.templateService.listTemplates(
      undefined, // tenantId will be extracted from context
      {
        category: category as any,
        includeSystem: include_system !== 'false',
        search,
      },
    );
  }

  @Post('templates')
  @ApiOperation({ summary: '创建自定义模板' })
  @ApiResponse({ status: 201, description: '模板创建成功' })
  @ApiBadRequestResponse({ description: '请求参数验证失败' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async createTemplate(@Body() data: CreateTemplateDto) {
    return this.templateService.createTemplate(undefined, data); // tenantId from context
  }

  @Get('templates/:id')
  @ApiOperation({ summary: '获取模板详情' })
  @ApiParam({ name: 'id', description: '模板ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: '成功返回模板详情' })
  @ApiNotFoundResponse({ description: '模板不存在' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async getTemplate(@Param('id') id: string) {
    return this.templateService.getTemplate(id, undefined); // tenantId from context
  }

  @Put('templates/:id')
  @ApiOperation({ summary: '更新自定义模板' })
  @ApiParam({ name: 'id', description: '模板ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: '模板更新成功' })
  @ApiNotFoundResponse({ description: '模板不存在' })
  @ApiBadRequestResponse({ description: '请求参数验证失败或无法修改系统模板' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async updateTemplate(@Param('id') id: string, @Body() data: UpdateTemplateDto) {
    return this.templateService.updateTemplate(id, undefined, data); // tenantId from context
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: '删除自定义模板' })
  @ApiParam({ name: 'id', description: '模板ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: '模板删除成功' })
  @ApiNotFoundResponse({ description: '模板不存在' })
  @ApiBadRequestResponse({ description: '无法删除系统模板' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async deleteTemplate(@Param('id') id: string) {
    const result = await this.templateService.deleteTemplate(id, undefined); // tenantId from context
    return { success: result };
  }

  // Multi-Currency Summary Endpoint

  @Get('summary/multicurrency')
  @ApiOperation({ summary: '获取多币种预算汇总' })
  @ApiQuery({ name: 'base_currency', required: false, description: '基准货币代码', example: 'USD' })
  @ApiResponse({ status: 200, description: '成功返回多币种汇总' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async getMultiCurrencySummary(@Query('base_currency') base_currency?: string) {
    // This will be implemented by MultiCurrencyBudgetService
    return this.budgetsService.getMultiCurrencySummary(base_currency);
  }

  @Get()
  @ApiOperation({ summary: '获取预算列表（分页）' })
  @ApiQuery({ name: 'offset', required: false, description: '分页偏移量，默认0', example: 0 })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量，默认20', example: 20 })
  @ApiQuery({ name: 'is_active', required: false, description: '是否只返回激活的预算', example: true })
  @ApiQuery({ name: 'status', required: false, description: '预算状态过滤', example: 'active' })
  @ApiQuery({ name: 'type', required: false, description: '预算类型过滤', example: 'periodic' })
  @ApiQuery({ name: 'search', required: false, description: '搜索关键词', example: 'food' })
  @ApiResponse({ status: 200, description: '成功返回预算列表（分页）' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async findAll(
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('is_active') is_active: string,
    @Query('status') status: string,
    @Query('type') type: string,
    @Query('search') search: string,
  ) {
    const params: BudgetListParams = {
      offset,
      limit,
      is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined,
      status,
      type,
      search,
    };
    return this.budgetsService.findWithPagination(params);
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID获取预算详情' })
  @ApiParam({ name: 'id', description: '预算ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: '成功返回预算详情' })
  @ApiNotFoundResponse({ description: '预算不存在' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async findById(@Param('id') id: string) {
    return this.budgetsService.findById(id);
  }

  @Get(':id/progress')
  @ApiOperation({ summary: '获取预算执行进度' })
  @ApiParam({ name: 'id', description: '预算ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiQuery({ name: 'target_currency', required: false, description: '目标货币代码', example: 'USD' })
  @ApiResponse({ status: 200, description: '返回预算执行进度，包含已使用金额、剩余金额、使用百分比等' })
  @ApiNotFoundResponse({ description: '预算不存在' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async getProgress(
    @Param('id') id: string,
    @Query('target_currency') target_currency?: string,
  ) {
    return this.budgetsService.getDetailedProgress(id, target_currency);
  }

  @Post()
  @ApiOperation({ summary: '创建新预算' })
  @ApiResponse({ status: 201, description: '预算创建成功' })
  @ApiBadRequestResponse({ description: '请求参数验证失败' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async create(@Body() data: CreateBudgetDto) {
    return this.budgetsService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新预算信息' })
  @ApiParam({ name: 'id', description: '预算ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: '预算更新成功' })
  @ApiNotFoundResponse({ description: '预算不存在' })
  @ApiBadRequestResponse({ description: '请求参数验证失败' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async update(@Param('id') id: string, @Body() data: UpdateBudgetDto) {
    return this.budgetsService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除预算（软删除）' })
  @ApiNoContentResponse({ description: '预算删除成功' })
  @ApiNotFoundResponse({ description: '预算不存在' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async delete(@Param('id') id: string) {
    await this.budgetsService.delete(id);
    return { success: true };
  }

  // Variance Report Endpoint

  @Get(':id/variance')
  @ApiOperation({ summary: '获取预算差异报告' })
  @ApiParam({ name: 'id', description: '预算ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiQuery({ name: 'granularity', required: false, description: '数据粒度', example: 'weekly' })
  @ApiQuery({ name: 'start_date', required: false, description: '报告开始日期', example: '2025-01-01' })
  @ApiQuery({ name: 'end_date', required: false, description: '报告结束日期', example: '2025-12-31' })
  @ApiResponse({ status: 200, description: '成功返回差异报告' })
  @ApiNotFoundResponse({ description: '预算不存在' })
  @ApiUnauthorizedResponse({ description: '未授权访问' })
  async getVarianceReport(
    @Param('id') id: string,
    @Query('granularity') granularity?: 'daily' | 'weekly' | 'monthly',
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    // This will be implemented by BudgetVarianceService
    return this.budgetsService.getVarianceReport(id, { granularity, start_date, end_date });
  }
}
