/**
 * Bot Manager Module
 * 
 * Centralized bot management system for all channels.
 * Handles bot creation, trigger engine, rule engine, action engine, and execution.
 */

export const moduleInfo = {
  name: 'bot-manager',
  apiPrefix: '/api/bots',
  description: 'Centralized bot management system',
  hasWorker: true,
  hasMigration: true,
};

// Re-export for module consumers
export { BotService } from './backend/bot.service';
export { BotController } from './backend/bot.controller';
export { default as botRoutes } from './backend/bot.routes';
export { runBotMigration } from './backend/bot-migrate';
export { startBotWorker } from './backend/bot.worker';
