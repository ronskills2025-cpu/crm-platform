import { pool } from '../packages/db/src/connection';
import { waSaasMigrate } from '../modules/wa-saas/backend/saas-migrate';

waSaasMigrate()
  .then(() => { console.log('WA-SaaS migration OK'); pool.end(); })
  .catch(e => { console.error('FAIL:', e.message); pool.end(); process.exit(1); });
