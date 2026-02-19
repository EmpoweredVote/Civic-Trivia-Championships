import cron from 'node-cron';
import { runExpirationSweep } from './expirationSweep.js';

/**
 * Start the expiration cron job
 *
 * Runs at minute 0 of every hour (e.g., 1:00, 2:00, 3:00)
 * Finds expired questions and updates their status
 */
export function startExpirationCron(): void {
  // Run at minute 0 of every hour
  cron.schedule('0 * * * *', async () => {
    await runExpirationSweep();
  });

  console.log('Expiration cron job registered (runs hourly at :00)');
}
