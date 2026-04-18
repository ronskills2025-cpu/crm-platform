import { query } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('growth-migrate');

export async function growthMigrate(): Promise<void> {
  log.info('Running growth platform migration…');

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 1: OMNICHANNEL LEAD CAPTURE
  // ══════════════════════════════════════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS lead_capture_forms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      source VARCHAR(50) NOT NULL DEFAULT 'website',
      form_fields JSONB NOT NULL DEFAULT '[]',
      auto_response_enabled BOOLEAN DEFAULT false,
      auto_response_channel VARCHAR(20) DEFAULT 'whatsapp',
      auto_response_template TEXT,
      auto_tags TEXT[] DEFAULT '{}',
      assigned_operator VARCHAR(200),
      webhook_url TEXT,
      is_active BOOLEAN DEFAULT true,
      submission_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lead_capture_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      form_id UUID REFERENCES lead_capture_forms(id) ON DELETE CASCADE,
      source VARCHAR(50) NOT NULL,
      channel VARCHAR(20),
      contact_value VARCHAR(200) NOT NULL,
      name VARCHAR(200),
      data JSONB DEFAULT '{}',
      lead_id UUID,
      auto_response_sent BOOLEAN DEFAULT false,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_lcf_tenant ON lead_capture_forms(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lcs_tenant ON lead_capture_submissions(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lcs_form ON lead_capture_submissions(form_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lcs_source ON lead_capture_submissions(source)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lcs_created ON lead_capture_submissions(created_at DESC)`);

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 2: MISSED CALL AUTOMATION
  // ══════════════════════════════════════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS missed_call_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      reply_channel VARCHAR(20) DEFAULT 'whatsapp',
      reply_template TEXT NOT NULL,
      followup_template TEXT,
      followup_delay_sec INT DEFAULT 300,
      capture_intent BOOLEAN DEFAULT true,
      intent_keywords JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS missed_calls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      config_id UUID REFERENCES missed_call_configs(id) ON DELETE SET NULL,
      caller_number VARCHAR(20) NOT NULL,
      called_number VARCHAR(20) NOT NULL,
      call_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reply_sent BOOLEAN DEFAULT false,
      reply_sent_at TIMESTAMPTZ,
      user_reply TEXT,
      detected_intent VARCHAR(100),
      lead_id UUID,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_mcc_tenant ON missed_call_configs(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_mc_tenant ON missed_calls(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_mc_config ON missed_calls(config_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_mc_caller ON missed_calls(caller_number)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_mc_status ON missed_calls(status)`);

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 3: SMART FOLLOW-UP SYSTEM
  // ══════════════════════════════════════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS followup_sequences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      trigger_type VARCHAR(50) NOT NULL DEFAULT 'no_reply',
      trigger_conditions JSONB DEFAULT '{}',
      steps JSONB NOT NULL DEFAULT '[]',
      notify_team BOOLEAN DEFAULT true,
      notification_channels TEXT[] DEFAULT '{whatsapp}',
      is_active BOOLEAN DEFAULT true,
      enrolled_count INT DEFAULT 0,
      completed_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS followup_enrollments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      sequence_id UUID REFERENCES followup_sequences(id) ON DELETE CASCADE,
      lead_id UUID NOT NULL,
      contact_value VARCHAR(200) NOT NULL,
      channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
      current_step INT DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      last_action_at TIMESTAMPTZ,
      next_action_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_fs_tenant ON followup_sequences(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_fe_tenant ON followup_enrollments(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_fe_sequence ON followup_enrollments(sequence_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_fe_status ON followup_enrollments(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_fe_next_action ON followup_enrollments(next_action_at) WHERE status = 'active'`);

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 4: LOYALTY SYSTEM
  // ══════════════════════════════════════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS loyalty_programs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      points_per_purchase INT DEFAULT 10,
      points_per_referral INT DEFAULT 50,
      points_per_review INT DEFAULT 25,
      currency_value NUMERIC(10,2) DEFAULT 0.01,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS loyalty_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      program_id UUID REFERENCES loyalty_programs(id) ON DELETE CASCADE,
      lead_id UUID,
      name VARCHAR(200),
      contact_value VARCHAR(200) NOT NULL,
      channel VARCHAR(20) DEFAULT 'whatsapp',
      points_balance INT DEFAULT 0,
      total_earned INT DEFAULT 0,
      total_redeemed INT DEFAULT 0,
      tier VARCHAR(50) DEFAULT 'bronze',
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      last_activity_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      member_id UUID REFERENCES loyalty_members(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL,
      points INT NOT NULL,
      description TEXT,
      reference_id VARCHAR(200),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS loyalty_rewards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      program_id UUID REFERENCES loyalty_programs(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      points_cost INT NOT NULL,
      reward_type VARCHAR(50) DEFAULT 'discount',
      reward_value JSONB DEFAULT '{}',
      stock INT DEFAULT -1,
      redemption_count INT DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_lp_tenant ON loyalty_programs(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lm_tenant ON loyalty_members(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lm_program ON loyalty_members(program_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lm_contact ON loyalty_members(contact_value)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lt_member ON loyalty_transactions(member_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lt_type ON loyalty_transactions(type)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lr_program ON loyalty_rewards(program_id)`);

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 5: REFERRAL SYSTEM
  // ══════════════════════════════════════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS referral_programs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      referrer_reward_points INT DEFAULT 100,
      referee_reward_points INT DEFAULT 50,
      referrer_reward_type VARCHAR(50) DEFAULT 'points',
      referee_reward_type VARCHAR(50) DEFAULT 'points',
      referrer_reward_value JSONB DEFAULT '{}',
      referee_reward_value JSONB DEFAULT '{}',
      max_referrals_per_user INT DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS referral_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      program_id UUID REFERENCES referral_programs(id) ON DELETE CASCADE,
      referrer_id UUID NOT NULL,
      referrer_name VARCHAR(200),
      referrer_contact VARCHAR(200),
      code VARCHAR(50) NOT NULL,
      url TEXT,
      clicks INT DEFAULT 0,
      conversions INT DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      program_id UUID REFERENCES referral_programs(id) ON DELETE CASCADE,
      link_id UUID REFERENCES referral_links(id) ON DELETE SET NULL,
      referrer_id UUID NOT NULL,
      referee_contact VARCHAR(200) NOT NULL,
      referee_name VARCHAR(200),
      status VARCHAR(20) DEFAULT 'pending',
      referrer_rewarded BOOLEAN DEFAULT false,
      referee_rewarded BOOLEAN DEFAULT false,
      converted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_rp_tenant ON referral_programs(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_rl_tenant ON referral_links(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_rl_code ON referral_links(code)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_rl_referrer ON referral_links(referrer_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ref_tenant ON referrals(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ref_program ON referrals(program_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ref_status ON referrals(status)`);

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 6: REVIEW BOOSTER
  // ══════════════════════════════════════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS review_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      google_review_url TEXT,
      delay_after_service_min INT DEFAULT 60,
      request_channel VARCHAR(20) DEFAULT 'whatsapp',
      request_template TEXT NOT NULL,
      positive_redirect_url TEXT,
      negative_followup_template TEXT,
      min_positive_rating INT DEFAULT 4,
      is_active BOOLEAN DEFAULT true,
      sent_count INT DEFAULT 0,
      response_count INT DEFAULT 0,
      positive_count INT DEFAULT 0,
      negative_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS review_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      campaign_id UUID REFERENCES review_campaigns(id) ON DELETE CASCADE,
      contact_value VARCHAR(200) NOT NULL,
      customer_name VARCHAR(200),
      channel VARCHAR(20) DEFAULT 'whatsapp',
      status VARCHAR(20) DEFAULT 'pending',
      sent_at TIMESTAMPTZ,
      rating INT,
      feedback TEXT,
      redirected_to_google BOOLEAN DEFAULT false,
      handled_privately BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_rc_tenant ON review_campaigns(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_rr_tenant ON review_requests(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_rr_campaign ON review_requests(campaign_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_rr_status ON review_requests(status)`);

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 7: SALES PIPELINE CRM
  // ══════════════════════════════════════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS pipelines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      stages JSONB NOT NULL DEFAULT '["New","Contacted","Interested","Proposal","Negotiation","Closed Won","Closed Lost"]',
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pipeline_deals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
      lead_id UUID,
      title VARCHAR(300) NOT NULL,
      contact_name VARCHAR(200),
      contact_value VARCHAR(200),
      stage VARCHAR(100) NOT NULL DEFAULT 'New',
      value NUMERIC(12,2) DEFAULT 0,
      currency VARCHAR(3) DEFAULT 'USD',
      probability INT DEFAULT 0,
      assigned_to VARCHAR(200),
      expected_close_date DATE,
      closed_at TIMESTAMPTZ,
      lost_reason TEXT,
      tags TEXT[] DEFAULT '{}',
      position INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pipeline_activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      deal_id UUID REFERENCES pipeline_deals(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      description TEXT,
      performed_by VARCHAR(200),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_pip_tenant ON pipelines(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pd_tenant ON pipeline_deals(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pd_pipeline ON pipeline_deals(pipeline_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pd_stage ON pipeline_deals(stage)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pd_assigned ON pipeline_deals(assigned_to)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pa_deal ON pipeline_activities(deal_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pa_created ON pipeline_activities(created_at DESC)`);

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 8: SEGMENTED BROADCAST
  // ══════════════════════════════════════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS broadcast_segments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      filter_rules JSONB NOT NULL DEFAULT '{}',
      contact_count INT DEFAULT 0,
      last_computed_at TIMESTAMPTZ,
      is_dynamic BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS broadcast_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      segment_id UUID REFERENCES broadcast_segments(id) ON DELETE SET NULL,
      name VARCHAR(200) NOT NULL,
      channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
      message_template TEXT NOT NULL,
      personalization_fields JSONB DEFAULT '{}',
      scheduled_at TIMESTAMPTZ,
      status VARCHAR(20) DEFAULT 'draft',
      total_recipients INT DEFAULT 0,
      sent_count INT DEFAULT 0,
      delivered_count INT DEFAULT 0,
      read_count INT DEFAULT 0,
      replied_count INT DEFAULT 0,
      failed_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_bs_tenant ON broadcast_segments(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bc_tenant ON broadcast_campaigns(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bc_segment ON broadcast_campaigns(segment_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bc_status ON broadcast_campaigns(status)`);

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 9: ADS PERFORMANCE TRACKER
  // ══════════════════════════════════════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS ad_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      platform VARCHAR(50) NOT NULL,
      campaign_name VARCHAR(300) NOT NULL,
      campaign_external_id VARCHAR(200),
      ad_set_name VARCHAR(300),
      ad_name VARCHAR(300),
      budget NUMERIC(12,2) DEFAULT 0,
      spend NUMERIC(12,2) DEFAULT 0,
      impressions INT DEFAULT 0,
      clicks INT DEFAULT 0,
      leads_count INT DEFAULT 0,
      conversions INT DEFAULT 0,
      revenue NUMERIC(12,2) DEFAULT 0,
      cpl NUMERIC(10,2) DEFAULT 0,
      cpa NUMERIC(10,2) DEFAULT 0,
      roas NUMERIC(10,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      start_date DATE,
      end_date DATE,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ad_conversions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      ad_campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
      lead_id UUID,
      contact_value VARCHAR(200),
      conversion_type VARCHAR(50) NOT NULL DEFAULT 'lead',
      value NUMERIC(12,2) DEFAULT 0,
      utm_source VARCHAR(200),
      utm_medium VARCHAR(200),
      utm_campaign VARCHAR(200),
      utm_content VARCHAR(200),
      landing_page TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_ac_tenant ON ad_campaigns(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ac_platform ON ad_campaigns(platform)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ac_status ON ad_campaigns(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_aconv_tenant ON ad_conversions(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_aconv_campaign ON ad_conversions(ad_campaign_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_aconv_type ON ad_conversions(conversion_type)`);

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 10: MINI WEBSITE BUILDER
  // ══════════════════════════════════════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS mini_websites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      slug VARCHAR(100) NOT NULL,
      domain TEXT,
      template VARCHAR(50) DEFAULT 'default',
      hero_title TEXT,
      hero_subtitle TEXT,
      hero_image_url TEXT,
      cta_text VARCHAR(100) DEFAULT 'Contact Us',
      cta_action VARCHAR(50) DEFAULT 'whatsapp',
      cta_value TEXT,
      sections JSONB DEFAULT '[]',
      form_fields JSONB DEFAULT '[]',
      whatsapp_widget_enabled BOOLEAN DEFAULT true,
      whatsapp_number VARCHAR(20),
      theme_color VARCHAR(7) DEFAULT '#6366f1',
      custom_css TEXT,
      seo_title VARCHAR(200),
      seo_description TEXT,
      favicon_url TEXT,
      is_published BOOLEAN DEFAULT false,
      visit_count INT DEFAULT 0,
      lead_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_mw_tenant ON mini_websites(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_mw_slug ON mini_websites(slug)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_mw_published ON mini_websites(is_published) WHERE is_published = true`);

  // ══════════════════════════════════════════════════════════════════════════
  //  GROWTH DASHBOARD STATS
  // ══════════════════════════════════════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS growth_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(300) NOT NULL,
      message TEXT,
      severity VARCHAR(20) DEFAULT 'info',
      link TEXT,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_gn_tenant ON growth_notifications(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_gn_read ON growth_notifications(is_read) WHERE is_read = false`);
  await query(`CREATE INDEX IF NOT EXISTS idx_gn_type ON growth_notifications(type)`);

  log.info('Growth platform migration complete');
}
