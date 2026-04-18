import { Worker, Job, Queue } from 'bullmq';
import { redis } from '../../../packages/db/src/redis';
import { query } from '../../../packages/db/src/connection';
import {
  InstagramAccountService, InstagramMessageService, InstagramCommentService,
  InstagramCommentRuleService, InstagramStoryRuleService,
  InstagramLeadBotService, InstagramLeadService,
  InstagramContentService, InstagramLogService,
  InstagramGraphAPI,
} from './instagram.service';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('worker:instagram');

type InstagramAction =
  | 'send_dm'
  | 'process_webhook'
  | 'publish_content'
  | 'comment_automation'
  | 'story_automation'
  | 'lead_processing'
  | 'lead_recovery'
  | 'content_scheduler'
  | 'engagement_sync';

interface InstagramJobData {
  action: InstagramAction;
  tenantId?: string;
  accountId?: string;
  [key: string]: unknown;
}

// ── Job processor ────────────────────────────────────────────────

const worker = new Worker<InstagramJobData>(
  'instagram',
  async (job: Job<InstagramJobData>) => {
    const { action, tenantId } = job.data;
    log.info('Processing instagram job', { action, tenantId, jobId: job.id });

    switch (action) {

      // ── Send DM via Graph API ─────────────────────────────────
      case 'send_dm': {
        const { accountId, recipientId, body, accessToken, igUserId } = job.data as {
          accountId: string; recipientId: string; body: string; accessToken: string; igUserId: string;
          tenantId: string; action: string;
        };
        const result = await InstagramGraphAPI.sendDM(accessToken, igUserId, recipientId, body);
        await InstagramMessageService.create({
          tenant_id: tenantId!, account_id: accountId,
          ig_message_id: result.messageId,
          sender_id: igUserId, recipient_id: recipientId,
          direction: 'outbound', message_type: 'text',
          body, status: result.success ? 'sent' : 'failed',
        });
        await InstagramLogService.log({
          tenant_id: tenantId!, account_id: accountId, log_type: 'dm_sent',
          ig_user_id: recipientId,
          message: result.success ? 'DM sent' : `DM failed: ${result.error}`,
          status: result.success ? 'success' : 'failed',
          error_detail: result.error,
        });
        break;
      }

      // ── Process incoming webhook ──────────────────────────────
      case 'process_webhook': {
        const payload = job.data.payload as Record<string, unknown>;
        if (!payload?.entry) break;
        const entries = (payload.entry as Array<Record<string, unknown>>) ?? [];

        for (const entry of entries) {
          const igUserId = entry.id as string;
          if (!igUserId) continue;

          // Find account
          const accounts = await query<{ id: string; tenant_id: string; ig_user_id: string; access_token: string }>(
            'SELECT id, tenant_id, ig_user_id, access_token FROM instagram_accounts WHERE ig_user_id = $1 AND is_active = true LIMIT 1',
            [igUserId]
          );
          const account = accounts.rows[0];
          if (!account) continue;

          // DM messages
          const messaging = (entry.messaging as Array<Record<string, unknown>>) ?? [];
          for (const msg of messaging) {
            const sender = (msg.sender as Record<string, string>)?.id;
            const message = msg.message as Record<string, unknown> | undefined;
            if (!sender || !message || sender === igUserId) continue;

            await InstagramMessageService.create({
              tenant_id: account.tenant_id, account_id: account.id,
              ig_message_id: message.mid as string,
              sender_id: sender, recipient_id: igUserId,
              direction: 'inbound', message_type: (message.attachments ? 'media' : 'text'),
              body: message.text as string,
              media_url: ((message.attachments as Array<Record<string, unknown>>)?.[0]?.payload as Record<string, string>)?.url,
            });

            // Check lead bot
            const botConfig = await InstagramLeadBotService.getActiveForAccount(account.id);
            if (botConfig) {
              const instagramQueue = new Queue<InstagramJobData>('instagram', { connection: redis });
              await instagramQueue.add('lead_processing', {
                action: 'lead_processing',
                tenantId: account.tenant_id,
                accountId: account.id,
                igUserId: sender,
                igUsername: (msg.sender as Record<string, string>)?.username,
                messageText: message.text as string,
                botConfigId: botConfig.id,
                accessToken: account.access_token,
                accountIgUserId: account.ig_user_id,
              });
            }
          }

          // Comment changes
          const changes = (entry.changes as Array<Record<string, unknown>>) ?? [];
          for (const change of changes) {
            if (change.field !== 'comments') continue;
            const value = change.value as Record<string, unknown>;
            if (!value) continue;

            const comment = await InstagramCommentService.upsert({
              tenant_id: account.tenant_id, account_id: account.id,
              ig_comment_id: value.id as string,
              ig_media_id: (value.media as Record<string, string>)?.id ?? (value.media_id as string) ?? '',
              ig_user_id: (value.from as Record<string, string>)?.id ?? '',
              username: (value.from as Record<string, string>)?.username,
              text: value.text as string,
              parent_id: value.parent_id as string,
              timestamp: new Date().toISOString(),
            });

            // Trigger comment-to-DM rules
            const instagramQueue = new Queue<InstagramJobData>('instagram', { connection: redis });
            await instagramQueue.add('comment_automation', {
              action: 'comment_automation',
              tenantId: account.tenant_id,
              accountId: account.id,
              commentId: comment.id,
              igMediaId: (value.media as Record<string, string>)?.id ?? (value.media_id as string) ?? '',
              commentText: value.text as string,
              commenterIgUserId: (value.from as Record<string, string>)?.id ?? '',
              commenterUsername: (value.from as Record<string, string>)?.username,
              accessToken: account.access_token,
              accountIgUserId: account.ig_user_id,
            });
          }

          // Story replies (mentions / replies)
          const storyMentions = (entry.story_mentions ?? entry.story_replies ?? []) as Array<Record<string, unknown>>;
          for (const story of storyMentions) {
            const senderStory = (story.sender as Record<string, string>)?.id;
            if (!senderStory || senderStory === igUserId) continue;
            const instagramQueue = new Queue<InstagramJobData>('instagram', { connection: redis });
            await instagramQueue.add('story_automation', {
              action: 'story_automation',
              tenantId: account.tenant_id,
              accountId: account.id,
              triggerType: entry.story_mentions ? 'story_mention' : 'story_reply',
              senderIgUserId: senderStory,
              senderUsername: (story.sender as Record<string, string>)?.username,
              storyText: (story.message as Record<string, string>)?.text,
              accessToken: account.access_token,
              accountIgUserId: account.ig_user_id,
            });
          }
        }
        break;
      }

      // ── Comment-to-DM automation ──────────────────────────────
      case 'comment_automation': {
        const {
          accountId, commentId, igMediaId, commentText, commenterIgUserId,
          commenterUsername, accessToken, accountIgUserId,
        } = job.data as Record<string, string>;
        if (!tenantId || !commentText) break;

        const rules = await InstagramCommentRuleService.getActiveRulesForMedia(tenantId, igMediaId);
        for (const rule of rules) {
          const keywords = (rule.keywords as string[]) ?? [];
          const matchType = rule.match_type ?? 'any';
          const text = commentText.toLowerCase();

          let matched = false;
          if (matchType === 'any') {
            matched = keywords.some(k => text.includes(k.toLowerCase()));
          } else if (matchType === 'all') {
            matched = keywords.every(k => text.includes(k.toLowerCase()));
          } else if (matchType === 'exact') {
            matched = keywords.some(k => text === k.toLowerCase());
          }
          if (!matched) continue;

          await InstagramCommentRuleService.incrementTrigger(rule.id);

          // A/B test: pick template
          const useA = Math.random() * 100 < (rule.ab_split ?? 100);
          const template = useA ? rule.dm_template : (rule.dm_template_b ?? rule.dm_template);
          const dmBody = template
            .replace('{{username}}', commenterUsername ?? 'there')
            .replace('{{comment}}', commentText);

          // Apply delay
          const minDelay = (rule.delay_min_sec ?? 0) * 1000;
          const maxDelay = (rule.delay_max_sec ?? 0) * 1000;
          const delay = minDelay + Math.random() * (maxDelay - minDelay);

          if (delay > 0) {
            const q = new Queue<InstagramJobData>('instagram', { connection: redis });
            await q.add('send_dm', {
              action: 'send_dm', tenantId, accountId,
              recipientId: commenterIgUserId, body: dmBody,
              accessToken, igUserId: accountIgUserId,
            }, { delay: Math.round(delay) });
          } else {
            const result = await InstagramGraphAPI.sendDM(accessToken, accountIgUserId, commenterIgUserId, dmBody);
            await InstagramMessageService.create({
              tenant_id: tenantId, account_id: accountId,
              ig_message_id: result.messageId,
              sender_id: accountIgUserId, recipient_id: commenterIgUserId,
              direction: 'outbound', message_type: 'text',
              body: dmBody, status: result.success ? 'sent' : 'failed',
              rule_id: rule.id, is_automated: true,
            });
            if (result.success) {
              await InstagramCommentRuleService.incrementDmSent(rule.id);
              await InstagramCommentService.markDmSent(commentId, rule.id);
            }
          }

          await InstagramLogService.log({
            tenant_id: tenantId, account_id: accountId, log_type: 'comment_dm',
            rule_id: rule.id, ig_user_id: commenterIgUserId, ig_username: commenterUsername,
            message: `Comment rule "${rule.name}" triggered for @${commenterUsername ?? 'unknown'}`,
            status: 'success',
          });
          break; // Only first matching rule
        }
        break;
      }

      // ── Story reply automation ────────────────────────────────
      case 'story_automation': {
        const {
          accountId, triggerType, senderIgUserId, senderUsername, storyText,
          accessToken, accountIgUserId,
        } = job.data as Record<string, string>;
        if (!tenantId) break;

        const rules = await InstagramStoryRuleService.getActiveRules(tenantId, triggerType);
        for (const rule of rules) {
          const keywords = (rule.keywords as string[]) ?? [];
          if (keywords.length > 0 && storyText) {
            const text = storyText.toLowerCase();
            const matchType = rule.match_type ?? 'any';
            let matched = false;
            if (matchType === 'any') matched = keywords.some(k => text.includes(k.toLowerCase()));
            else if (matchType === 'all') matched = keywords.every(k => text.includes(k.toLowerCase()));
            if (!matched) continue;
          }

          const useA = Math.random() * 100 < (rule.ab_split ?? 100);
          const template = useA ? rule.dm_template : (rule.dm_template_b ?? rule.dm_template);
          const dmBody = template.replace('{{username}}', senderUsername ?? 'there');

          const result = await InstagramGraphAPI.sendDM(accessToken, accountIgUserId, senderIgUserId, dmBody);
          await InstagramMessageService.create({
            tenant_id: tenantId, account_id: accountId,
            sender_id: accountIgUserId, recipient_id: senderIgUserId,
            direction: 'outbound', message_type: 'text',
            body: dmBody, status: result.success ? 'sent' : 'failed',
            rule_id: rule.id, is_automated: true,
          });

          // Schedule followup
          if (result.success && rule.followup_template && (rule.followup_delay_sec ?? 0) > 0) {
            const q = new Queue<InstagramJobData>('instagram', { connection: redis });
            await q.add('send_dm', {
              action: 'send_dm', tenantId, accountId,
              recipientId: senderIgUserId, body: rule.followup_template.replace('{{username}}', senderUsername ?? 'there'),
              accessToken, igUserId: accountIgUserId,
            }, { delay: (rule.followup_delay_sec ?? 0) * 1000 });
          }

          await InstagramLogService.log({
            tenant_id: tenantId, account_id: accountId, log_type: 'story_reply',
            rule_id: rule.id, ig_user_id: senderIgUserId, ig_username: senderUsername,
            message: `Story rule "${rule.name}" triggered for @${senderUsername ?? 'unknown'}`,
            status: result.success ? 'success' : 'failed',
          });
          break;
        }
        break;
      }

      // ── Lead bot processing ───────────────────────────────────
      case 'lead_processing': {
        const {
          accountId, igUserId: senderUserId, igUsername, messageText,
          botConfigId, accessToken, accountIgUserId,
        } = job.data as Record<string, string>;
        if (!tenantId || !senderUserId) break;

        const config = await InstagramLeadBotService.getById(botConfigId);
        if (!config || !config.is_active) break;
        const steps = (config.steps as Array<{ question: string; field: string; type: string; options?: string[]; score?: number }>) ?? [];

        // Upsert lead
        const lead = await InstagramLeadService.upsert({
          tenant_id: tenantId, account_id: accountId,
          bot_config_id: botConfigId,
          ig_user_id: senderUserId, ig_username: igUsername,
        });

        const currentStep = lead.current_step ?? 0;

        // If fresh lead (step 0, no answers yet), send welcome + first question
        if (currentStep === 0 && (!lead.answers || Object.keys(lead.answers as Record<string, unknown>).length === 0)) {
          const welcomeMsg = config.welcome_message ?? 'Hi! Let me help you get started.';
          await InstagramGraphAPI.sendDM(accessToken, accountIgUserId, senderUserId, welcomeMsg);
          await InstagramMessageService.create({
            tenant_id: tenantId, account_id: accountId,
            sender_id: accountIgUserId, recipient_id: senderUserId,
            direction: 'outbound', body: welcomeMsg, is_automated: true,
          });

          if (steps[0]) {
            let q = steps[0].question;
            if (steps[0].options?.length) q += '\n' + steps[0].options.map((o, i) => `${i + 1}. ${o}`).join('\n');
            await InstagramGraphAPI.sendDM(accessToken, accountIgUserId, senderUserId, q);
            await InstagramMessageService.create({
              tenant_id: tenantId, account_id: accountId,
              sender_id: accountIgUserId, recipient_id: senderUserId,
              direction: 'outbound', body: q, is_automated: true,
            });
          }
          break;
        }

        // Record answer for current step
        const stepDef = steps[currentStep];
        if (!stepDef) break;
        await InstagramLeadService.updateStep(lead.id, currentStep + 1, stepDef.field, messageText, stepDef.score);

        // If more steps, ask next question
        const nextStep = steps[currentStep + 1];
        if (nextStep) {
          let q = nextStep.question;
          if (nextStep.options?.length) q += '\n' + nextStep.options.map((o, i) => `${i + 1}. ${o}`).join('\n');
          await InstagramGraphAPI.sendDM(accessToken, accountIgUserId, senderUserId, q);
          await InstagramMessageService.create({
            tenant_id: tenantId, account_id: accountId,
            sender_id: accountIgUserId, recipient_id: senderUserId,
            direction: 'outbound', body: q, is_automated: true,
          });
        } else {
          // All steps done — complete lead
          const updatedLead = await InstagramLeadService.getById(lead.id);
          const totalScore = updatedLead?.score ?? 0;
          const segment = totalScore >= 80 ? 'hot' : totalScore >= 40 ? 'warm' : 'cold';
          await InstagramLeadService.complete(lead.id, segment);

          if (config.completion_message) {
            await InstagramGraphAPI.sendDM(accessToken, accountIgUserId, senderUserId, config.completion_message);
            await InstagramMessageService.create({
              tenant_id: tenantId, account_id: accountId,
              sender_id: accountIgUserId, recipient_id: senderUserId,
              direction: 'outbound', body: config.completion_message, is_automated: true,
            });
          }

          await InstagramLogService.log({
            tenant_id: tenantId, account_id: accountId, log_type: 'lead_completed',
            lead_id: lead.id, ig_user_id: senderUserId, ig_username: igUsername,
            message: `Lead @${igUsername ?? 'unknown'} completed (${segment}, score: ${totalScore})`,
            status: 'success',
          });
        }
        break;
      }

      // ── Lead recovery (dropped leads) ─────────────────────────
      case 'lead_recovery': {
        // Find all tenant accounts
        const tenants = await query<{ tenant_id: string }>(
          'SELECT DISTINCT tenant_id FROM instagram_accounts WHERE is_active = true'
        );
        for (const t of tenants.rows) {
          const dropped = await InstagramLeadService.getDropped(t.tenant_id, 24);
          for (const lead of dropped) {
            const botConfig = lead.bot_config_id ? await InstagramLeadBotService.getById(lead.bot_config_id) : null;
            if (!botConfig?.recovery_message) {
              await InstagramLeadService.markDropped(lead.id);
              continue;
            }
            const account = await InstagramAccountService.getById(lead.account_id);
            if (!account) continue;

            const msg = botConfig.recovery_message.replace('{{username}}', lead.ig_username ?? 'there');
            const result = await InstagramGraphAPI.sendDM(account.access_token, account.ig_user_id, lead.ig_user_id, msg);
            if (result.success) {
              await InstagramLeadService.markRecovered(lead.id);
              await InstagramMessageService.create({
                tenant_id: t.tenant_id, account_id: account.id,
                sender_id: account.ig_user_id, recipient_id: lead.ig_user_id,
                direction: 'outbound', body: msg, is_automated: true,
              });
            } else {
              await InstagramLeadService.markDropped(lead.id);
            }

            await InstagramLogService.log({
              tenant_id: t.tenant_id, account_id: account.id, log_type: 'lead_recovery',
              lead_id: lead.id, ig_user_id: lead.ig_user_id,
              message: result.success ? `Recovery DM sent to @${lead.ig_username ?? 'unknown'}` : `Recovery failed for @${lead.ig_username ?? 'unknown'}`,
              status: result.success ? 'success' : 'failed',
              error_detail: result.error,
            });
          }
        }
        break;
      }

      // ── Content scheduler ─────────────────────────────────────
      case 'content_scheduler': {
        const scheduled = await InstagramContentService.getScheduled();
        for (const item of scheduled) {
          const account = await InstagramAccountService.getById(item.account_id);
          if (!account) {
            await InstagramContentService.fail(item.id, 'Account not found');
            continue;
          }
          try {
            const mediaUrl = (item.media_urls as string[])?.[0];
            const result = await InstagramGraphAPI.publishMedia(account.access_token, account.ig_user_id, {
              imageUrl: item.content_type === 'post' || item.content_type === 'carousel' ? mediaUrl : undefined,
              videoUrl: item.content_type === 'reel' || item.content_type === 'story' ? mediaUrl : undefined,
              caption: item.caption ?? undefined,
              mediaType: item.content_type,
            });
            if (result.success && result.igMediaId) {
              await InstagramContentService.publish(item.id, result.igMediaId);
              await InstagramLogService.log({
                tenant_id: item.tenant_id, account_id: item.account_id,
                log_type: 'content_published', content_id: item.id,
                message: `Published ${item.content_type}`, status: 'success',
              });
            } else {
              await InstagramContentService.fail(item.id, result.error ?? 'Publish failed');
              await InstagramLogService.log({
                tenant_id: item.tenant_id, account_id: item.account_id,
                log_type: 'content_publish_failed', content_id: item.id,
                message: `Publish failed: ${result.error}`, status: 'failed',
                error_detail: result.error,
              });
            }
          } catch (err) {
            await InstagramContentService.fail(item.id, (err as Error).message);
          }
        }
        break;
      }

      // ── Publish specific content item ─────────────────────────
      case 'publish_content': {
        const contentId = job.data.contentId as string;
        if (!contentId) break;
        const item = await InstagramContentService.getById(contentId);
        if (!item || item.status === 'published') break;
        const account = await InstagramAccountService.getById(item.account_id);
        if (!account) { await InstagramContentService.fail(contentId, 'Account not found'); break; }

        const mediaUrl = (item.media_urls as string[])?.[0];
        const result = await InstagramGraphAPI.publishMedia(account.access_token, account.ig_user_id, {
          imageUrl: item.content_type === 'post' || item.content_type === 'carousel' ? mediaUrl : undefined,
          videoUrl: item.content_type === 'reel' || item.content_type === 'story' ? mediaUrl : undefined,
          caption: item.caption ?? undefined,
          mediaType: item.content_type,
        });
        if (result.success && result.igMediaId) {
          await InstagramContentService.publish(contentId, result.igMediaId);
        } else {
          await InstagramContentService.fail(contentId, result.error ?? 'Publish failed');
        }
        break;
      }

      // ── Engagement sync ───────────────────────────────────────
      case 'engagement_sync': {
        const published = await query<{ id: string; ig_media_id: string; account_id: string }>(
          `SELECT c.id, c.ig_media_id, c.account_id FROM instagram_content c
           WHERE c.status = 'published' AND c.ig_media_id IS NOT NULL
             AND c.published_at > NOW() - INTERVAL '7 days'
           LIMIT 100`
        );
        for (const item of published.rows) {
          const account = await InstagramAccountService.getById(item.account_id);
          if (!account) continue;
          const insights = await InstagramGraphAPI.getMediaInsights(account.access_token, item.ig_media_id);
          if (Object.keys(insights).length > 0) {
            await InstagramContentService.updateEngagement(item.id, insights);
          }
        }
        break;
      }

      default:
        log.warn(`Unknown instagram action: ${action}`);
    }
  },
  { connection: redis, concurrency: 5 }
);

worker.on('failed', (job: Job<InstagramJobData> | undefined, err?: Error) => {
  log.error(`Instagram job ${job?.id} (${job?.data?.action}) failed`, err);
});

log.info('Instagram worker started');

// ── Schedule recurring jobs ───────────────────────────────────

async function scheduleRecurring() {
  const q = new Queue<InstagramJobData>('instagram', { connection: redis });

  await q.add('content_scheduler', { action: 'content_scheduler' }, {
    repeat: { every: 60_000 }, // every minute (check for scheduled content)
    jobId: 'recurring:instagram_content_scheduler',
  });

  await q.add('lead_recovery', { action: 'lead_recovery' }, {
    repeat: { every: 3_600_000 }, // hourly
    jobId: 'recurring:instagram_lead_recovery',
  });

  await q.add('engagement_sync', { action: 'engagement_sync' }, {
    repeat: { every: 3_600_000 }, // hourly
    jobId: 'recurring:instagram_engagement_sync',
  });

  log.info('Recurring instagram jobs scheduled');
}

scheduleRecurring().catch((err) => log.error('Failed to schedule instagram jobs', err));

export default worker;
