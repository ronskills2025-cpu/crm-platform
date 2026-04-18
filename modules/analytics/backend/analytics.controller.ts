import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AnalyticsService } from './analytics.service';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';

const DateFilterSchema = z.object({
  from:        z.string().optional(),
  to:          z.string().optional(),
  channel:     z.string().optional(),
  campaign_id: z.string().optional(),
});

function parseFilters(req: AuthRequest) {
  const q = DateFilterSchema.parse(req.query);
  return { ...q, tenant_id: req.tenantId };
}

export const AnalyticsController = {
  summary: (async (req: AuthRequest, res) => {
    try {
      const data = await AnalyticsService.getSummary(parseFilters(req));
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch analytics summary' });
    }
  }) as RequestHandler,

  leads: (async (req: AuthRequest, res) => {
    try {
      const data = await AnalyticsService.aggregateLeads(parseFilters(req));
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch leads analytics' });
    }
  }) as RequestHandler,

  campaigns: (async (req: AuthRequest, res) => {
    try {
      const data = await AnalyticsService.aggregateCampaigns(parseFilters(req));
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch campaigns analytics' });
    }
  }) as RequestHandler,

  channels: (async (req: AuthRequest, res) => {
    try {
      const data = await AnalyticsService.aggregateChannels(parseFilters(req));
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch channels analytics' });
    }
  }) as RequestHandler,

  revenue: (async (req: AuthRequest, res) => {
    try {
      const data = await AnalyticsService.aggregateRevenue(parseFilters(req));
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch revenue analytics' });
    }
  }) as RequestHandler,

  automation: (async (req: AuthRequest, res) => {
    try {
      const data = await AnalyticsService.aggregateAutomation(parseFilters(req));
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch automation analytics' });
    }
  }) as RequestHandler,

  dashboard: (async (req: AuthRequest, res) => {
    try {
      const filters = parseFilters(req);
      
      // Get summary data which includes all aggregated data
      const summary = await AnalyticsService.getSummary(filters);

      // Format for GlobalDashboard component
      const stats = {
        totalLeads: (summary as any).leads?.total || 0,
        messagesSent: (summary as any).channels?.reduce((sum: number, ch: any) => sum + (ch.sent || 0), 0) || 0,
        smsDelivered: (summary as any).channels?.find((ch: any) => ch.channel === 'sms')?.delivered || 0,
        emailOpens: (summary as any).channels?.find((ch: any) => ch.channel === 'email')?.delivered || 0,
        conversions: (summary as any).leads?.conversion_rate || 0,
        automations: (summary as any).campaigns?.running || 0,
      };

      const channelData = ((summary as any).channels || []).map((ch: any) => ({
        name: ch.channel.charAt(0).toUpperCase() + ch.channel.slice(1),
        messages: ch.sent || 0,
        color: getChannelColor(ch.channel),
        percentage: ch.delivery_rate || 0
      }));

      res.json({ stats, channels: channelData });
    } catch (err) {
      console.error('Dashboard error:', err);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  }) as RequestHandler,
};

function getChannelColor(channel: string): string {
  const colors: Record<string, string> = {
    whatsapp: 'bg-emerald-500',
    sms: 'bg-blue-500',
    email: 'bg-purple-500',
    telegram: 'bg-sky-500',
    messenger: 'bg-indigo-500',
    instagram: 'bg-pink-500',
  };
  return colors[channel] || 'bg-gray-500';
}
