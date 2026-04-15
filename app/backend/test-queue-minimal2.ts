/**
 * Minimal test for BullMQ with proper async handling
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';

async function test() {
  // First test Redis directly
  console.log('Testing Redis connection...');
  const redis = new Redis({
    host: 'localhost',
    port: 6379,
  });

  await redis.set('test', 'value');
  const val = await redis.get('test');
  console.log(`✓ Redis working: ${val}`);
  await redis.quit();

  // Now test BullMQ
  console.log('Creating BullMQ queue...');
  const queue = new Queue('test-queue', {
    connection: {
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
    },
  });

  console.log('Waiting for queue to be ready...');
  await queue.waitUntilReady();
  console.log('✓ Queue ready');

  console.log('Adding job...');
  const job = await queue.add('test-job', { data: 'hello' });
  console.log(`✓ Job ${job.id} added successfully`);

  await queue.close();
  console.log('✓ Done!');
  process.exit(0);
}

test().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
