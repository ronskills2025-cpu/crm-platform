import { z } from 'zod';

export const ChannelSchema = z.enum(['whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram']);

export const ListThreadsQuerySchema = z.object({
  channel: ChannelSchema,
  search: z.string().optional(),
  status: z.enum(['all', 'unread', 'read', 'replied']).optional(),
  assigned_to: z.string().optional(),
  vip_only: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const IncomingMessageSchema = z.object({
  channel: ChannelSchema,
  sender: z.string().min(1),
  recipient: z.string().optional(),
  body: z.string().min(1),
  subject: z.string().optional(),
  provider: z.string().optional(),
  external_message_id: z.string().optional(),
  campaign_id: z.string().uuid().optional(),
  lead_name: z.string().optional(),
  assigned_to: z.string().optional(),
  is_vip: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ReplyMessageSchema = z.object({
  body: z.string().min(1, 'Reply message is required'),
  subject: z.string().optional(),
  provider: z.string().optional(),
  assigned_to: z.string().optional(),
});

export const AssignThreadSchema = z.object({
  assigned_to: z.string().min(1),
});

export type InboxChannel = z.infer<typeof ChannelSchema>;
export type IncomingMessageInput = z.infer<typeof IncomingMessageSchema>;
export type ReplyMessageInput = z.infer<typeof ReplyMessageSchema>;
