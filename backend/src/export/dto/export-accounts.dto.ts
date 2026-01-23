import { IsOptional, IsArray, IsEnum, IsBoolean, IsIn } from 'class-validator';
import { AccountType } from '../../accounts/account.entity';

export class ExportAccountsDto {
  @IsOptional()
  @IsArray()
  @IsEnum(AccountType, { each: true })
  account_types?: AccountType[];

  @IsOptional()
  @IsBoolean()
  include_inactive?: boolean;

  @IsOptional()
  @IsBoolean()
  include_header?: boolean;

  @IsOptional()
  @IsIn([',', ';', '\t'])
  delimiter?: ',' | ';' | '\t';
}
