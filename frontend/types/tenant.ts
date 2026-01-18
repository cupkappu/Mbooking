export interface Tenant {
  id: string;
  user_id: string;
  name: string;
  settings: {
    default_currency?: string;
    timezone?: string;
    [key: string]: any;
  };
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}