/**
 * Meta Compliance Controller
 * Handles opt-in management, message validation, and compliance reporting
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import { ComplianceService } from './compliance.service';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('compliance-controller');

export class ComplianceController {
  
  // ═══════════════════════════════════════════════════════════════
  // OPT-IN MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Record opt-in consent
   * POST /api/compliance/opt-in
   */
  static async recordOptIn(req: AuthRequest, res: Response) {
    try {
      const { phoneNumber, method, source, consentText } = req.body;
      
      if (!phoneNumber || !method || !source || !consentText) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['phoneNumber', 'method', 'source', 'consentText']
        });
      }
      
      // Validate phone number format
      if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
        return res.status(400).json({
          error: 'Invalid phone number format',
          details: 'Phone number must be in international format (e.g., +1234567890)'
        });
      }
      
      const optInRecord = await ComplianceService.recordOptIn({
        tenantId: req.tenantId!,
        phoneNumber,
        method,
        source,
        consentText,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Opt-in consent recorded successfully',
        optInRecord: {
          id: optInRecord.id,
          phoneNumber: optInRecord.phone_number,
          method: optInRecord.opt_in_method,
          optedInAt: optInRecord.opted_in_at
        }
      });
      
    } catch (error) {
      log.error('Failed to record opt-in:', error);
      res.status(500).json({
        error: 'Failed to record opt-in consent',
        details: 'An internal error occurred'
      });
    }
  }
  
  /**
   * Record opt-out (unsubscribe)
   * POST /api/compliance/opt-out
   */
  static async recordOptOut(req: AuthRequest, res: Response) {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({
          error: 'Phone number is required'
        });
      }
      
      await ComplianceService.recordOptOut(req.tenantId!, phoneNumber);
      
      res.json({
        success: true,
        message: 'Opt-out recorded successfully'
      });
      
    } catch (error) {
      log.error('Failed to record opt-out:', error);
      res.status(500).json({
        error: 'Failed to record opt-out',
        details: 'An internal error occurred'
      });
    }
  }
  
  /**
   * Check opt-in status
   * GET /api/compliance/opt-in-status/:phoneNumber
   */
  static async checkOptInStatus(req: AuthRequest, res: Response) {
    try {
      const { phoneNumber } = req.params;
      
      if (!phoneNumber) {
        return res.status(400).json({
          error: 'Phone number is required'
        });
      }
      
      const hasOptIn = await ComplianceService.hasValidOptIn(req.tenantId!, phoneNumber);
      const optInRecord = hasOptIn ? await ComplianceService.getOptInRecord(req.tenantId!, phoneNumber) : null;
      
      res.json({
        phoneNumber,
        hasValidOptIn: hasOptIn,
        optInRecord: optInRecord ? {
          method: optInRecord.opt_in_method,
          source: optInRecord.opt_in_source,
          optedInAt: optInRecord.opted_in_at
        } : null
      });
      
    } catch (error) {
      log.error('Failed to check opt-in status:', error);
      res.status(500).json({
        error: 'Failed to check opt-in status',
        details: 'An internal error occurred'
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // MESSAGE VALIDATION
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Validate message before sending
   * POST /api/compliance/validate-message
   */
  static async validateMessage(req: AuthRequest, res: Response) {
    try {
      const { phoneNumber, messageType, messageContent } = req.body;
      
      if (!phoneNumber || !messageType || !messageContent) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['phoneNumber', 'messageType', 'messageContent']
        });
      }
      
      const validation = await ComplianceService.validateMessage({
        tenantId: req.tenantId!,
        phoneNumber,
        messageType,
        messageContent
      });
      
      // Log the validation attempt
      await ComplianceService.logMessage({
        tenantId: req.tenantId!,
        phoneNumber,
        messageType,
        messageContent,
        optInVerified: validation.approved,
        complianceStatus: validation.approved ? 'approved' : 'rejected',
        rejectionReason: validation.reason
      });
      
      res.json({
        approved: validation.approved,
        reason: validation.reason,
        phoneNumber,
        messageType
      });
      
    } catch (error) {
      log.error('Failed to validate message:', error);
      res.status(500).json({
        error: 'Failed to validate message',
        details: 'An internal error occurred'
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // COMPLIANCE REPORTING
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Get compliance report
   * GET /api/compliance/report?days=30
   */
  static async getComplianceReport(req: AuthRequest, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      
      if (days < 1 || days > 365) {
        return res.status(400).json({
          error: 'Invalid days parameter',
          details: 'Days must be between 1 and 365'
        });
      }
      
      const [complianceReport, optInStats] = await Promise.all([
        ComplianceService.getComplianceReport(req.tenantId!, days),
        ComplianceService.getOptInStats(req.tenantId!)
      ]);
      
      res.json({
        period: `${days} days`,
        messages: {
          total: parseInt(complianceReport.total_messages) || 0,
          approved: parseInt(complianceReport.approved_messages) || 0,
          rejected: parseInt(complianceReport.rejected_messages) || 0,
          flagged: parseInt(complianceReport.flagged_messages) || 0,
          optInVerified: parseInt(complianceReport.opt_in_verified_messages) || 0
        },
        optIns: {
          active: parseInt(optInStats.active_opt_ins) || 0,
          optOuts: parseInt(optInStats.opt_outs) || 0,
          byMethod: {
            website: parseInt(optInStats.website_opt_ins) || 0,
            qrCode: parseInt(optInStats.qr_opt_ins) || 0,
            keyword: parseInt(optInStats.keyword_opt_ins) || 0
          }
        },
        complianceScore: complianceReport.total_messages > 0 
          ? Math.round((complianceReport.approved_messages / complianceReport.total_messages) * 100)
          : 100
      });
      
    } catch (error) {
      log.error('Failed to get compliance report:', error);
      res.status(500).json({
        error: 'Failed to generate compliance report',
        details: 'An internal error occurred'
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC OPT-IN/OPT-OUT ENDPOINTS (NO AUTH REQUIRED)
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Public opt-in endpoint (for websites, QR codes, etc.)
   * POST /api/public/opt-in/:tenantId
   */
  static async publicOptIn(req: Request, res: Response) {
    try {
      const { tenantId } = req.params;
      const { phoneNumber, source, consentText } = req.body;
      
      if (!phoneNumber || !source || !consentText) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['phoneNumber', 'source', 'consentText']
        });
      }
      
      // Validate tenant exists
      // Note: Add tenant validation logic here
      
      await ComplianceService.recordOptIn({
        tenantId,
        phoneNumber,
        method: 'website',
        source,
        consentText,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Thank you for opting in to receive messages!'
      });
      
    } catch (error) {
      log.error('Failed to process public opt-in:', error);
      res.status(500).json({
        error: 'Failed to process opt-in request'
      });
    }
  }
  
  /**
   * Public opt-out endpoint (for unsubscribe links)
   * POST /api/public/opt-out/:tenantId
   */
  static async publicOptOut(req: Request, res: Response) {
    try {
      const { tenantId } = req.params;
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({
          error: 'Phone number is required'
        });
      }
      
      await ComplianceService.recordOptOut(tenantId, phoneNumber);
      
      res.json({
        success: true,
        message: 'You have been successfully unsubscribed from all messages.'
      });
      
    } catch (error) {
      log.error('Failed to process public opt-out:', error);
      res.status(500).json({
        error: 'Failed to process unsubscribe request'
      });
    }
  }
}
