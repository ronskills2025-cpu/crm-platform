/**
 * Meta WhatsApp Business Platform Compliance Service
 * Ensures all messaging complies with Meta policies and regulations
 */

import { query } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('compliance-service');

export interface OptInRecord {
  id: string;
  tenant_id: string;
  phone_number: string;
  opt_in_method: 'website' | 'qr_code' | 'keyword' | 'manual' | 'api';
  opt_in_source: string;
  consent_text: string;
  ip_address?: string;
  user_agent?: string;
  opted_in_at: Date;
  opted_out_at?: Date;
  is_active: boolean;
}

export interface MessageAuditLog {
  id: string;
  tenant_id: string;
  phone_number: string;
  message_type: 'template' | 'text' | 'media';
  message_content: string;
  opt_in_verified: boolean;
  compliance_status: 'approved' | 'rejected' | 'flagged';
  rejection_reason?: string;
  sent_at: Date;
}

export class ComplianceService {
  
  // ═══════════════════════════════════════════════════════════════
  // OPT-IN MANAGEMENT (CRITICAL FOR META COMPLIANCE)
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Record explicit opt-in consent from user
   */
  static async recordOptIn(data: {
    tenantId: string;
    phoneNumber: string;
    method: OptInRecord['opt_in_method'];
    source: string;
    consentText: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<OptInRecord> {
    
    // First, opt-out any existing records for this phone number
    await this.recordOptOut(data.tenantId, data.phoneNumber);
    
    const result = await query<OptInRecord>(
      `INSERT INTO opt_in_records 
       (tenant_id, phone_number, opt_in_method, opt_in_source, consent_text, ip_address, user_agent, opted_in_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), true)
       RETURNING *`,
      [
        data.tenantId,
        data.phoneNumber,
        data.method,
        data.source,
        data.consentText,
        data.ipAddress,
        data.userAgent
      ]
    );
    
    log.info('Opt-in recorded', { 
      tenantId: data.tenantId, 
      phone: data.phoneNumber.substring(0, 5) + '***',
      method: data.method 
    });
    
    return result.rows[0];
  }
  
  /**
   * Record opt-out (unsubscribe)
   */
  static async recordOptOut(tenantId: string, phoneNumber: string): Promise<void> {
    await query(
      `UPDATE opt_in_records 
       SET opted_out_at = NOW(), is_active = false, updated_at = NOW()
       WHERE tenant_id = $1 AND phone_number = $2 AND is_active = true`,
      [tenantId, phoneNumber]
    );
    
    log.info('Opt-out recorded', { 
      tenantId, 
      phone: phoneNumber.substring(0, 5) + '***' 
    });
  }
  
  /**
   * Check if phone number has valid opt-in consent
   */
  static async hasValidOptIn(tenantId: string, phoneNumber: string): Promise<boolean> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM opt_in_records 
       WHERE tenant_id = $1 AND phone_number = $2 AND is_active = true`,
      [tenantId, phoneNumber]
    );
    
    return parseInt(result.rows[0].count) > 0;
  }
  
  /**
   * Get opt-in record for phone number
   */
  static async getOptInRecord(tenantId: string, phoneNumber: string): Promise<OptInRecord | null> {
    const result = await query<OptInRecord>(
      `SELECT * FROM opt_in_records 
       WHERE tenant_id = $1 AND phone_number = $2 AND is_active = true
       ORDER BY opted_in_at DESC LIMIT 1`,
      [tenantId, phoneNumber]
    );
    
    return result.rows[0] || null;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // MESSAGE COMPLIANCE VALIDATION
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Validate message before sending (Meta compliance check)
   */
  static async validateMessage(data: {
    tenantId: string;
    phoneNumber: string;
    messageType: MessageAuditLog['message_type'];
    messageContent: string;
  }): Promise<{ approved: boolean; reason?: string }> {
    
    // Check 1: Verify opt-in consent
    const hasOptIn = await this.hasValidOptIn(data.tenantId, data.phoneNumber);
    if (!hasOptIn) {
      return {
        approved: false,
        reason: 'No valid opt-in consent found for this phone number'
      };
    }
    
    // Check 2: Content filtering (spam/inappropriate content)
    const contentCheck = this.validateMessageContent(data.messageContent);
    if (!contentCheck.approved) {
      return contentCheck;
    }
    
    // Check 3: Rate limiting check
    const rateLimitCheck = await this.checkRateLimit(data.tenantId, data.phoneNumber);
    if (!rateLimitCheck.approved) {
      return rateLimitCheck;
    }
    
    return { approved: true };
  }
  
  /**
   * Content filtering for spam/inappropriate content
   */
  private static validateMessageContent(content: string): { approved: boolean; reason?: string } {
    
    // Prohibited content patterns
    const prohibitedPatterns = [
      /\b(spam|scam|fraud|fake|illegal)\b/i,
      /\b(buy now|click here|limited time|urgent|act now)\b/i,
      /\b(bitcoin|crypto|investment|loan|debt)\b/i,
      /\b(adult|porn|sex|gambling|casino)\b/i,
      /\b(hate|violence|threat|harm)\b/i
    ];
    
    for (const pattern of prohibitedPatterns) {
      if (pattern.test(content)) {
        return {
          approved: false,
          reason: 'Message content contains prohibited terms'
        };
      }
    }
    
    // Check for excessive capitalization (spam indicator)
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.5 && content.length > 20) {
      return {
        approved: false,
        reason: 'Excessive use of capital letters detected'
      };
    }
    
    return { approved: true };
  }
  
  /**
   * Rate limiting check (prevent spam)
   */
  private static async checkRateLimit(tenantId: string, phoneNumber: string): Promise<{ approved: boolean; reason?: string }> {
    
    // Check messages sent in last hour
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM message_audit_logs 
       WHERE tenant_id = $1 AND phone_number = $2 
       AND sent_at > NOW() - INTERVAL '1 hour'
       AND compliance_status = 'approved'`,
      [tenantId, phoneNumber]
    );
    
    const messagesInLastHour = parseInt(result.rows[0].count);
    
    // Limit: 10 messages per hour per phone number
    if (messagesInLastHour >= 10) {
      return {
        approved: false,
        reason: 'Rate limit exceeded: Maximum 10 messages per hour per phone number'
      };
    }
    
    return { approved: true };
  }
  
  /**
   * Log message for audit trail
   */
  static async logMessage(data: {
    tenantId: string;
    phoneNumber: string;
    messageType: MessageAuditLog['message_type'];
    messageContent: string;
    optInVerified: boolean;
    complianceStatus: MessageAuditLog['compliance_status'];
    rejectionReason?: string;
  }): Promise<MessageAuditLog> {
    
    const result = await query<MessageAuditLog>(
      `INSERT INTO message_audit_logs 
       (tenant_id, phone_number, message_type, message_content, opt_in_verified, compliance_status, rejection_reason, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        data.tenantId,
        data.phoneNumber,
        data.messageType,
        data.messageContent,
        data.optInVerified,
        data.complianceStatus,
        data.rejectionReason
      ]
    );
    
    log.info('Message logged for audit', {
      tenantId: data.tenantId,
      phone: data.phoneNumber.substring(0, 5) + '***',
      status: data.complianceStatus
    });
    
    return result.rows[0];
  }
  
  // ═══════════════════════════════════════════════════════════════
  // COMPLIANCE REPORTING
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Get compliance report for tenant
   */
  static async getComplianceReport(tenantId: string, days: number = 30) {
    const result = await query(
      `SELECT 
         COUNT(*) as total_messages,
         COUNT(*) FILTER (WHERE compliance_status = 'approved') as approved_messages,
         COUNT(*) FILTER (WHERE compliance_status = 'rejected') as rejected_messages,
         COUNT(*) FILTER (WHERE compliance_status = 'flagged') as flagged_messages,
         COUNT(*) FILTER (WHERE opt_in_verified = true) as opt_in_verified_messages
       FROM message_audit_logs 
       WHERE tenant_id = $1 AND sent_at > NOW() - INTERVAL '${days} days'`,
      [tenantId]
    );
    
    return result.rows[0];
  }
  
  /**
   * Get opt-in statistics for tenant
   */
  static async getOptInStats(tenantId: string) {
    const result = await query(
      `SELECT 
         COUNT(*) FILTER (WHERE is_active = true) as active_opt_ins,
         COUNT(*) FILTER (WHERE is_active = false) as opt_outs,
         COUNT(*) FILTER (WHERE opt_in_method = 'website') as website_opt_ins,
         COUNT(*) FILTER (WHERE opt_in_method = 'qr_code') as qr_opt_ins,
         COUNT(*) FILTER (WHERE opt_in_method = 'keyword') as keyword_opt_ins
       FROM opt_in_records 
       WHERE tenant_id = $1`,
      [tenantId]
    );
    
    return result.rows[0];
  }
}
