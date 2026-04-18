export interface Provider {
  id: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'telegram' | 'messenger';
  is_active: boolean;
  priority: number;
  cost_per_msg: number;
  success_rate: number;
  daily_limit: number;
  daily_sent: number;
  config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}
