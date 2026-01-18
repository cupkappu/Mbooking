import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JournalService } from './journal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('journal')
@Controller('journal')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JournalController {
  constructor(private journalService: JournalService) {}

  @Get()
  @ApiOperation({ summary: 'Get journal entries' })
  async findAll(
    @Request() req,
    @Query('offset') offset?: number,
    @Query('limit') limit?: number,
  ) {
    const entries = await this.journalService.findAll(req.user.tenantId, { offset, limit });
    return { entries };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get journal entry by ID' })
  async findById(@Param('id') id: string, @Request() req) {
    return this.journalService.findById(id, req.user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create journal entry' })
  async create(@Body() data: any, @Request() req) {
    return this.journalService.create(data, req.user.tenantId, req.user.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update journal entry' })
  async update(@Param('id') id: string, @Body() data: any, @Request() req) {
    return this.journalService.update(id, data, req.user.tenantId, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete journal entry' })
  async delete(@Param('id') id: string, @Request() req) {
    await this.journalService.delete(id, req.user.tenantId);
    return { success: true };
  }
}
