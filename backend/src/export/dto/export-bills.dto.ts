import { IsOptional, IsString, IsArray, IsEnum, IsBoolean, IsIn, ValidateIf } from 'class-validator';
import { AccountType } from '../../accounts/account.entity';

export enum DatePreset {
  LAST_30_DAYS = 'last_30_days',
  LAST_90_DAYS = 'last_90_days',
  THIS_YEAR = 'this_year',
  ALL_TIME = 'all_time',
}

export class ExportBillsDto {
  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsEnum(DatePreset)
  date_preset?: DatePreset;

  @IsOptional()
  @IsArray()
  @IsEnum(AccountType, { each: true })
  account_types?: AccountType[];

  @IsOptional()
  @IsBoolean()
  include_header?: boolean;

  @IsOptional()
  @IsIn([',', ';', '\t'])
  delimiter?: ',' | ';' | '\t';

  @ValidateIf((o) => !o.date_preset)
  @IsOptional()
  date_from_validated?: Date;

  @ValidateIf((o) => !o.date_preset)
  @IsOptional()
  date_to_validated?: Date;
}
