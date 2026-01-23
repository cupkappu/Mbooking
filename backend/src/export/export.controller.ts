import { Controller, Post, Body, Res, Header, HttpCode, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';
import { ExportBillsDto } from './dto/export-bills.dto';
import { ExportAccountsDto } from './dto/export-accounts.dto';

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post('bills')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="bills.csv"')
  async exportBills(@Body() dto: ExportBillsDto, @Res() res: Response): Promise<void> {
    try {
      const stream = await this.exportService.exportBillsToCsv(dto);
      
      res.on('finish', () => {
        stream.destroy();
      });

      stream.pipe(res);
    } catch (error) {
      if (error instanceof BadRequestException) {
        res.status(400).json({
          success: false,
          error_code: 'INVALID_REQUEST',
          error_message: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error_code: 'EXPORT_FAILED',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  @Post('accounts')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="accounts.csv"')
  async exportAccounts(@Body() dto: ExportAccountsDto, @Res() res: Response): Promise<void> {
    try {
      const stream = await this.exportService.exportAccountsToCsv(dto);
      
      res.on('finish', () => {
        stream.destroy();
      });

      stream.pipe(res);
    } catch (error) {
      if (error instanceof BadRequestException) {
        res.status(400).json({
          success: false,
          error_code: 'INVALID_REQUEST',
          error_message: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error_code: 'EXPORT_FAILED',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }
}
