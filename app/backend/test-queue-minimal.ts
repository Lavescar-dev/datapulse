/**
 * Minimal test for BullMQ - just test job submission
 */

import { Queue } from 'bullmq';

const redisOptions = {
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
};

async function test() {
  console.log('Creating queue...');
  const queue = new Queue('test-queue', { connection: redisOptions });

  console.log('Adding job...');
  const job = await queue.add('test-job', { data: 'hello' });
  console.log(`Job ${job.id} added successfully`);

  await queue.close();
  console.log('Done!');
  process.exit(0);
}

test().catch(console.error);
