import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsString()
  @IsIn([
    'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NZD',
    'KRW', 'SGD', 'NOK', 'MXN', 'INR', 'RUB', 'ZAR', 'TRY', 'BRL', 'TWD',
    'DKK', 'PLN', 'THB', 'IDR', 'HUF', 'CZK', 'ILS', 'CLP', 'PHP', 'AED',
    'COP', 'SAR', 'MYR', 'EGP', 'ARS', 'QAR', 'VND', 'UAH', 'KWD', 'PKR',
    'BDT', 'LKR', 'NGN', 'GHS', 'KES', 'TZS', 'UGX', 'RWF', 'MAD', 'XOF',
    'XAF', 'ZMW', 'AOA', 'MZN', 'SZL', 'LSL', 'BWP', 'NAD', 'SCR', 'MUR',
    'FJD', 'SBD', 'PGK', 'TOP', 'WST', 'KMF', 'MRU', 'MGA', 'XPF', 'CDF',
    'BIF', 'ERN', 'ETB', 'GMD', 'GNF', 'LRD', 'LYD', 'MRO', 'SDG', 'SLL',
    'SOS', 'SSP', 'STD', 'TJS', 'TMT', 'UGX', 'UZS', 'VEF', 'VES', 'YER',
    'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT',
    'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BSD', 'BTN', 'BZD', 'CVE', 'DJF',
    'DOP', 'DZD', 'ERN', 'ETB', 'FJD', 'FKP', 'GEL', 'GHS', 'GIP', 'GMD',
    'GNF', 'GTQ', 'GYD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR', 'ILS', 'INR',
    'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'KES', 'KGS', 'KHR', 'KMF', 'KPW',
    'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD',
    'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK',
    'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR',
    'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PYG', 'QAR', 'RON', 'RSD', 'RUB',
    'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLL', 'SOS',
    'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND',
    'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'UYU', 'UZS', 'VED',
    'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF', 'YER', 'ZAR',
    'ZMW'
  ])
  default_currency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}