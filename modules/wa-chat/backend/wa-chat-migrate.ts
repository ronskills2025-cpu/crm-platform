import { pool } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('wa-chat-migrate');

const schema = `
-- ── WhatsApp Live Chat: User Credentials ──────────────────────────
CREATE TABLE IF NOT EXISTS wa_chat_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  phone_number_id VARCHAR(100) NOT NULL,
  access_token TEXT NOT NULL,
  business_account_id VARCHAR(100),
  display_name VARCHAR(255),
  phone_display VARCHAR(30),
  is_active BOOLEAN DEFAULT true,
  token_expires_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, phone_number_id)
);

-- ── WhatsApp Live Chat: Contacts ──────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_chat_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  wa_id VARCHAR(30) NOT NULL,
  display_name VARCHAR(255),
  profile_pic_url TEXT,
  phone VARCHAR(30),
  is_blocked BOOLEAN DEFAULT false,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, wa_id)
);

-- ── WhatsApp Live Chat: Conversations ─────────────────────────────
CREATE TABLE IF NOT EXISTS wa_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  contact_id UUID REFERENCES wa_chat_contacts(id) ON DELETE CASCADE,
  wa_id VARCHAR(30) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
  unread_count INTEGER DEFAULT 0,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  assigned_to UUID,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, wa_id)
);

-- ── WhatsApp Live Chat: Messages ──────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  conversation_id UUID REFERENCES wa_chat_conversations(id) ON DELETE CASCADE,
  wa_message_id VARCHAR(200),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact', 'reaction', 'template', 'interactive', 'unknown')),
  body TEXT,
  media_url TEXT,
  media_mime_type VARCHAR(100),
  media_filename VARCHAR(255),
  media_caption TEXT,
  reaction_emoji VARCHAR(10),
  reaction_message_id VARCHAR(200),
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── WhatsApp Live Chat: Webhook Configuration ────────────────────
CREATE TABLE IF NOT EXISTS wa_chat_webhook_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_url TEXT NOT NULL,
  verify_token VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default webhook config if none exists
INSERT INTO wa_chat_webhook_config (webhook_url, verify_token, is_active)
SELECT 
  'https://api.msgcrm.com/api/wa-chat/webhook',
  'msgcrm_wa_verify_2024',
  true
WHERE NOT EXISTS (SELECT 1 FROM wa_chat_webhook_config WHERE is_active = true);

-- ── 24-Hour Window Tracking ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_chat_conversation_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  conversation_id UUID REFERENCES wa_chat_conversations(id) ON DELETE CASCADE,
  wa_id VARCHAR(30) NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, window_start)
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wa_chat_creds_tenant ON wa_chat_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_chat_contacts_tenant ON wa_chat_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_chat_contacts_wa_id ON wa_chat_contacts(tenant_id, wa_id);
CREATE INDEX IF NOT EXISTS idx_wa_chat_convos_tenant ON wa_chat_conversations(tenant_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_chat_convos_contact ON wa_chat_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_wa_chat_msgs_convo ON wa_chat_messages(conversation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wa_chat_msgs_wa_id ON wa_chat_messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_wa_chat_msgs_tenant ON wa_chat_messages(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wa_chat_msgs_status ON wa_chat_messages(conversation_id, status) WHERE direction = 'outbound';
CREATE INDEX IF NOT EXISTS idx_wa_chat_windows_active ON wa_chat_conversation_windows(conversation_id, is_active, window_end);
CREATE INDEX IF NOT EXISTS idx_wa_chat_windows_tenant ON wa_chat_conversation_windows(tenant_id, window_end DESC);
`;

export async function waChatMigrate(): Promise<void> {
  try {
    await pool.query(schema);
    log.info('WhatsApp Live Chat tables ready');
  } catch (err) {
    log.warn('WhatsApp Live Chat migration warning', { error: (err as Error).message });
  }
}
