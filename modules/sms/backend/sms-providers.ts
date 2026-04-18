/**
 * Pluggable SMS Provider abstraction layer.
 *
 * Each provider implements the SMSProvider interface so the service
 * layer calls a consistent API regardless of the underlying vendor.
 */

export interface SMSProviderPayload {
  phone: string;
  message: string;
  senderId?: string;
  dltTemplateId?: string;
  dltEntityId?: string;
  region?: string;
}

export interface SMSProviderResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  cost?: number;
}

export interface SMSDeliveryStatus {
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'unknown';
  updatedAt?: Date;
  error?: string;
}

export interface SMSProvider {
  readonly name: string;
  sendSMS(payload: SMSProviderPayload): Promise<SMSProviderResponse>;
  getDeliveryStatus?(messageId: string): Promise<SMSDeliveryStatus>;
}

// ── Twilio ────────────────────────────────────────────────────────

export class TwilioProvider implements SMSProvider {
  readonly name = 'twilio';
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private costPerMsg: number;

  constructor(creds: Record<string, string | undefined>, costPerMsg = 0.0075) {
    this.accountSid = creds.accountSid || '';
    this.authToken = creds.authToken || '';
    this.fromNumber = creds.fromNumber || '';
    this.costPerMsg = costPerMsg;
  }

  async sendSMS(payload: SMSProviderPayload): Promise<SMSProviderResponse> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      const body = new URLSearchParams({
        To: payload.phone.startsWith('+') ? payload.phone : `+${payload.phone}`,
        From: payload.senderId || this.fromNumber,
        Body: payload.message,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
        },
        body,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errBody = await response.text();
        return { success: false, error: `Twilio HTTP ${response.status}: ${errBody}` };
      }

      const data = (await response.json()) as { sid?: string; error_message?: string };
      if (data.error_message) {
        return { success: false, error: data.error_message };
      }
      return { success: true, messageId: data.sid, cost: this.costPerMsg };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Twilio send failed' };
    }
  }

  async getDeliveryStatus(messageId: string): Promise<SMSDeliveryStatus> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages/${messageId}.json`;
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      const response = await fetch(url, {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return { status: 'unknown' };
      const data = (await response.json()) as { status: string };
      const map: Record<string, SMSDeliveryStatus['status']> = {
        queued: 'queued', sending: 'sent', sent: 'sent', delivered: 'delivered',
        undelivered: 'failed', failed: 'failed',
      };
      return { status: map[data.status] || 'unknown', updatedAt: new Date() };
    } catch {
      return { status: 'unknown' };
    }
  }
}

// ── AWS SNS ───────────────────────────────────────────────────────

export class AwsSnsProvider implements SMSProvider {
  readonly name = 'aws_sns';
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private costPerMsg: number;

  constructor(creds: Record<string, string | undefined>, costPerMsg = 0.0065) {
    this.region = creds.region || 'us-east-1';
    this.accessKeyId = creds.accessKeyId || '';
    this.secretAccessKey = creds.secretAccessKey || '';
    this.costPerMsg = costPerMsg;
  }

  async sendSMS(payload: SMSProviderPayload): Promise<SMSProviderResponse> {
    try {
      const endpoint = `https://sns.${this.region}.amazonaws.com/`;
      const params = new URLSearchParams({
        Action: 'Publish',
        PhoneNumber: payload.phone.startsWith('+') ? payload.phone : `+${payload.phone}`,
        Message: payload.message,
        Version: '2010-03-31',
      });

      if (payload.senderId) {
        params.append('MessageAttributes.entry.1.Name', 'AWS.SNS.SMS.SenderID');
        params.append('MessageAttributes.entry.1.Value.DataType', 'String');
        params.append('MessageAttributes.entry.1.Value.StringValue', payload.senderId);
      }

      // AWS Signature V4 simplified — uses standard Authorization header
      const now = new Date();
      const dateStamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 8);
      const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const body = params.toString();

      // For production, use proper AWS SDK or Signature V4 signing.
      // This implementation uses pre-signed credentials approach.
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Amz-Date': amzDate,
          Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${dateStamp}/${this.region}/sns/aws4_request`,
        },
        body,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errBody = await response.text();
        return { success: false, error: `AWS SNS HTTP ${response.status}: ${errBody.slice(0, 200)}` };
      }

      const text = await response.text();
      const messageIdMatch = text.match(/<MessageId>(.+?)<\/MessageId>/);
      return {
        success: true,
        messageId: messageIdMatch?.[1] || undefined,
        cost: this.costPerMsg,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'AWS SNS send failed' };
    }
  }
}

// ── Custom HTTP Provider ──────────────────────────────────────────

export class CustomHttpProvider implements SMSProvider {
  readonly name: string;
  private apiUrl: string;
  private apiKey: string;
  private senderId?: string;
  private costPerMsg: number;
  private headers: Record<string, string>;
  private bodyTemplate: Record<string, string>;

  constructor(
    providerName: string,
    creds: Record<string, string | undefined>,
    costPerMsg = 0,
  ) {
    this.name = providerName;
    this.apiUrl = creds.apiUrl || '';
    this.apiKey = creds.apiKey || '';
    this.senderId = creds.senderId;
    this.costPerMsg = costPerMsg;
    this.headers = creds.headers ? JSON.parse(creds.headers) : {};
    this.bodyTemplate = creds.bodyTemplate ? JSON.parse(creds.bodyTemplate) : {};
  }

  async sendSMS(payload: SMSProviderPayload): Promise<SMSProviderResponse> {
    try {
      const body: Record<string, string> = {
        ...this.bodyTemplate,
        phone: payload.phone,
        message: payload.message,
        sender_id: payload.senderId || this.senderId || '',
      };
      if (payload.dltTemplateId) body.dlt_template_id = payload.dltTemplateId;
      if (payload.dltEntityId) body.dlt_entity_id = payload.dltEntityId;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...this.headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errBody = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errBody.slice(0, 200)}` };
      }

      const data = (await response.json()) as { message_id?: string; id?: string; request_id?: string };
      return {
        success: true,
        messageId: data.message_id || data.id || data.request_id,
        cost: this.costPerMsg,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Custom HTTP send failed' };
    }
  }
}

// ── Indian Providers (existing) ───────────────────────────────────

export class Fast2SmsProvider implements SMSProvider {
  readonly name = 'fast2sms';
  private apiKey: string;
  private senderId?: string;
  private dltEntityId?: string;
  private costPerMsg: number;

  constructor(creds: Record<string, string | undefined>, costPerMsg = 0.15) {
    this.apiKey = creds.apiKey || '';
    this.senderId = creds.senderId;
    this.dltEntityId = creds.dltEntityId;
    this.costPerMsg = costPerMsg;
  }

  async sendSMS(payload: SMSProviderPayload): Promise<SMSProviderResponse> {
    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: this.apiKey },
        body: JSON.stringify({
          route: 'dlt',
          sender_id: payload.senderId || this.senderId,
          message: payload.dltTemplateId || '',
          variables_values: payload.message,
          flash: 0,
          numbers: payload.phone,
          ...(payload.dltEntityId || this.dltEntityId ? { entity_id: payload.dltEntityId || this.dltEntityId } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${await response.text()}` };
      }
      const data = (await response.json()) as { request_id?: string };
      return { success: true, messageId: data.request_id, cost: this.costPerMsg };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Fast2SMS failed' };
    }
  }
}

export class Msg91Provider implements SMSProvider {
  readonly name = 'msg91';
  private authKey: string;
  private senderId?: string;
  private costPerMsg: number;

  constructor(creds: Record<string, string | undefined>, costPerMsg = 0.20) {
    this.authKey = creds.authKey || '';
    this.senderId = creds.senderId;
    this.costPerMsg = costPerMsg;
  }

  async sendSMS(payload: SMSProviderPayload): Promise<SMSProviderResponse> {
    try {
      const phone = payload.phone.startsWith('91') ? payload.phone : `91${payload.phone}`;
      const response = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authkey: this.authKey },
        body: JSON.stringify({
          template_id: payload.dltTemplateId,
          sender: payload.senderId || this.senderId,
          short_url: '0',
          mobiles: phone,
          VAR1: payload.message,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${await response.text()}` };
      }
      const data = (await response.json()) as { request_id?: string; message_id?: string };
      return { success: true, messageId: data.request_id || data.message_id, cost: this.costPerMsg };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'MSG91 failed' };
    }
  }
}

export class TextLocalProvider implements SMSProvider {
  readonly name = 'textlocal';
  private apiKey: string;
  private sender?: string;
  private dltEntityId?: string;
  private costPerMsg: number;

  constructor(creds: Record<string, string | undefined>, costPerMsg = 0.25) {
    this.apiKey = creds.apiKey || '';
    this.sender = creds.sender;
    this.dltEntityId = creds.dltEntityId;
    this.costPerMsg = costPerMsg;
  }

  async sendSMS(payload: SMSProviderPayload): Promise<SMSProviderResponse> {
    try {
      const response = await fetch('https://api.textlocal.in/send/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          apikey: this.apiKey,
          numbers: payload.phone,
          message: payload.message,
          sender: this.sender || payload.senderId || '',
          ...(payload.dltTemplateId ? { template_id: payload.dltTemplateId } : {}),
          ...(payload.dltEntityId || this.dltEntityId ? { entity_id: payload.dltEntityId || this.dltEntityId } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${await response.text()}` };
      }
      const data = (await response.json()) as { message_id?: string };
      return { success: true, messageId: data.message_id, cost: this.costPerMsg };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'TextLocal failed' };
    }
  }
}

// ── Self Provider (You ARE the provider) ──────────────────────────

/**
 * SelfProvider — treats your own SMS gateway/API as a first-class provider.
 * Configure your own endpoint, auth, and send either via DLT-registered
 * sender IDs or via virtual numbers (unofficial / non-DLT mode).
 */
export class SelfProvider implements SMSProvider {
  readonly name = 'self';
  private gatewayUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private defaultSenderId?: string;
  private costPerMsg: number;
  private headers: Record<string, string>;
  private method: string;

  constructor(creds: Record<string, string | undefined>, costPerMsg = 0) {
    this.gatewayUrl = creds.gatewayUrl || '';
    this.apiKey = creds.apiKey || '';
    this.apiSecret = creds.apiSecret || '';
    this.defaultSenderId = creds.senderId;
    this.costPerMsg = costPerMsg;
    this.headers = creds.headers ? JSON.parse(creds.headers) : {};
    this.method = (creds.method || 'POST').toUpperCase();
  }

  async sendSMS(payload: SMSProviderPayload): Promise<SMSProviderResponse> {
    try {
      if (!this.gatewayUrl) {
        return { success: false, error: 'Self provider gateway URL not configured' };
      }

      const body: Record<string, unknown> = {
        phone: payload.phone,
        message: payload.message,
        sender_id: payload.senderId || this.defaultSenderId || '',
      };

      // DLT fields — only sent when DLT mode is active
      if (payload.dltTemplateId) body.dlt_template_id = payload.dltTemplateId;
      if (payload.dltEntityId) body.dlt_entity_id = payload.dltEntityId;

      // Region info
      if (payload.region) body.region = payload.region;

      const response = await fetch(this.gatewayUrl, {
        method: this.method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'X-Api-Key': this.apiKey } : {}),
          ...(this.apiSecret ? { 'X-Api-Secret': this.apiSecret } : {}),
          ...this.headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errBody = await response.text();
        return { success: false, error: `Gateway HTTP ${response.status}: ${errBody.slice(0, 200)}` };
      }

      const data = (await response.json()) as {
        message_id?: string; id?: string; request_id?: string;
        success?: boolean; error?: string;
      };

      if (data.success === false) {
        return { success: false, error: data.error || 'Gateway returned failure' };
      }

      return {
        success: true,
        messageId: data.message_id || data.id || data.request_id,
        cost: this.costPerMsg,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Self provider send failed' };
    }
  }

  async getDeliveryStatus(messageId: string): Promise<SMSDeliveryStatus> {
    try {
      if (!this.gatewayUrl) return { status: 'unknown' };
      const statusUrl = `${this.gatewayUrl.replace(/\/+$/, '')}/status/${encodeURIComponent(messageId)}`;
      const response = await fetch(statusUrl, {
        headers: {
          ...(this.apiKey ? { 'X-Api-Key': this.apiKey } : {}),
          ...(this.apiSecret ? { 'X-Api-Secret': this.apiSecret } : {}),
          ...this.headers,
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return { status: 'unknown' };
      const data = (await response.json()) as { status: string };
      const map: Record<string, SMSDeliveryStatus['status']> = {
        queued: 'queued', sending: 'sent', sent: 'sent', delivered: 'delivered',
        undelivered: 'failed', failed: 'failed',
      };
      return { status: map[data.status] || 'unknown', updatedAt: new Date() };
    } catch {
      return { status: 'unknown' };
    }
  }
}

// ── Factory ───────────────────────────────────────────────────────

export function createSmsProvider(
  providerName: string,
  creds: Record<string, string | undefined>,
  costPerMsg: number,
): SMSProvider {
  switch (providerName) {
    case 'self':
      return new SelfProvider(creds, costPerMsg);
    case 'twilio':
      return new TwilioProvider(creds, costPerMsg);
    case 'aws_sns':
      return new AwsSnsProvider(creds, costPerMsg);
    case 'fast2sms':
      return new Fast2SmsProvider(creds, costPerMsg);
    case 'msg91':
      return new Msg91Provider(creds, costPerMsg);
    case 'textlocal':
      return new TextLocalProvider(creds, costPerMsg);
    default:
      return new CustomHttpProvider(providerName, creds, costPerMsg);
  }
}
