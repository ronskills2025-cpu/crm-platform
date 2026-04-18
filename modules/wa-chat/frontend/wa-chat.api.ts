import api from '../../../packages/utils/src/http';

// ── Types ────────────────────────────────────────────────────────

export interface WaChatCredentials {
  phone_number_id: string;
  business_account_id?: string;
  display_name?: string;
  is_active: boolean;
  last_verified_at: string | null;
  has_access_token: boolean;
}

export interface WaChatContact {
  id: string;
  wa_id: string;
  display_name: string | null;
  profile_pic_url: string | null;
}

export interface WaChatConversation {
  id: string;
  contact_id: string;
  wa_id: string;
  display_name: string | null;
  profile_pic_url: string | null;
  unread_count: number;
  last_message_text: string | null;
  last_message_at: string | null;
  status: 'active' | 'archived' | 'closed';
  is_pinned: boolean;
}

export interface WaChatMessage {
  id: string;
  conversation_id: string;
  wa_message_id: string | null;
  direction: 'inbound' | 'outbound';
  message_type: string;
  body: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  media_caption: string | null;
  reaction_emoji: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  error_message: string | null;
  created_at: string;
}

// ── Credentials ──────────────────────────────────────────────────

export async function getCredentials() {
  const { data } = await api.get('/wa-chat/credentials');
  return data as { success: boolean; credentials: WaChatCredentials | null; webhook_url: string; verify_token: string };
}

export async function saveCredentials(body: {
  phone_number_id: string;
  access_token: string;
  business_account_id?: string;
  display_name?: string;
}) {
  const { data } = await api.post('/wa-chat/credentials', body);
  return data;
}

export async function verifyCredentials() {
  const { data } = await api.post('/wa-chat/credentials/verify');
  return data as { success: boolean; valid: boolean; phoneNumber?: string };
}

export async function deleteCredentials() {
  const { data } = await api.delete('/wa-chat/credentials');
  return data;
}

// ── Conversations ────────────────────────────────────────────────

export async function listConversations(opts?: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const { data } = await api.get('/wa-chat/conversations', { params: opts });
  return data as { success: boolean; conversations: WaChatConversation[] };
}

export async function getConversation(id: string) {
  const { data } = await api.get(`/wa-chat/conversations/${id}`);
  return data as { success: boolean; conversation: WaChatConversation };
}

export async function markConversationRead(id: string) {
  const { data } = await api.post(`/wa-chat/conversations/${id}/read`);
  return data;
}

export async function archiveConversation(id: string) {
  const { data } = await api.post(`/wa-chat/conversations/${id}/archive`);
  return data;
}

export async function pinConversation(id: string, pinned: boolean) {
  const { data } = await api.post(`/wa-chat/conversations/${id}/pin`, { pinned });
  return data;
}

// ── Messages ─────────────────────────────────────────────────────

export async function listMessages(conversationId: string, opts?: { limit?: number; before?: string }) {
  const { data } = await api.get(`/wa-chat/conversations/${conversationId}/messages`, { params: opts });
  return data as { success: boolean; messages: WaChatMessage[] };
}

export async function sendTextMessage(conversationId: string, text: string) {
  const { data } = await api.post(`/wa-chat/conversations/${conversationId}/send`, { text });
  return data as { success: boolean; message: WaChatMessage };
}

export async function sendMediaMessage(conversationId: string, body: {
  type: 'image' | 'document' | 'video' | 'audio';
  url: string;
  caption?: string;
  filename?: string;
}) {
  const { data } = await api.post(`/wa-chat/conversations/${conversationId}/send-media`, body);
  return data as { success: boolean; message: WaChatMessage };
}

export async function getWindowStatus(conversationId: string) {
  const { data } = await api.get(`/wa-chat/conversations/${conversationId}/window-status`);
  return data as { 
    success: boolean; 
    can_send: boolean; 
    time_remaining: number;
    window_expires_in_hours: number;
    window_expires_in_minutes: number;
  };
}

// ── Contacts ─────────────────────────────────────────────────────

export async function listContacts(search?: string) {
  const { data } = await api.get('/wa-chat/contacts', { params: search ? { search } : undefined });
  return data as { success: boolean; contacts: WaChatContact[] };
}

// ── Unified API object ───────────────────────────────────────────

export const waChatApi = {
  getCredentials,
  saveCredentials,
  verifyCredentials,
  deleteCredentials,
  listConversations,
  getConversation,
  markConversationRead,
  archiveConversation,
  pinConversation,
  listMessages,
  sendTextMessage,
  sendMediaMessage,
  getWindowStatus,
  listContacts,
};
