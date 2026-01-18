import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QueryService, BalanceQuery } from './query.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('query')
@Controller('query')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QueryController {
  constructor(private queryService: QueryService) {}

  @Post('balances')
  @ApiOperation({ summary: 'Query account balances' })
  async getBalances(@Body() query: BalanceQuery, @Request() req) {
    return this.queryService.getBalances(req.user.tenantId, query);
  }

  @Post('journal-entries')
  @ApiOperation({ summary: 'Query journal entries' })
  async getJournalEntries(@Body() query: any, @Request() req) {
    return this.queryService.getJournalEntries(req.user.tenantId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get dashboard summary data' })
  async getSummary(@Request() req) {
    return this.queryService.getSummary(req.user.tenantId);
  }
}
