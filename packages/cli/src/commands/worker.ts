import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Command } from 'commander';

/**
 * Register the worker command
 * This command spawns a Node.js process to run the MetricYak worker
 */
export function registerWorkerCommand(program: Command): void {
  program
    .command('worker')
    .description('Start the MetricYak worker process')
    .option('-c, --concurrency <number>', 'Number of concurrent jobs to process', '5')
    .option('-q, --queue <name>', 'Queue name to process', 'metricyak')
    .option('-h, --redis-host <host>', 'Redis host', 'localhost')
    .option('-p, --redis-port <port>', 'Redis port', '6379')
    .action(async (options) => {
      console.log('[MetricYak CLI] Starting worker...');
      console.log('[MetricYak CLI] Options:', options);

      // Get the path to the worker package
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      // Navigate to the worker package entry point
      // From packages/cli/dist/commands -> packages/worker/dist/index.js
      const workerPath = join(__dirname, '..', '..', '..', 'worker', 'dist', 'index.js');

      console.log(`[MetricYak CLI] Worker path: ${workerPath}`);

      // Set up environment variables for the worker
      const env = {
        ...process.env,
        METRICYAK_CONCURRENCY: options.concurrency,
        METRICYAK_QUEUE_NAME: options.queue,
        METRICYAK_REDIS_HOST: options.redisHost,
        METRICYAK_REDIS_PORT: options.redisPort,
      };

      // Spawn the worker process
      const workerProcess = spawn('node', [workerPath], {
        stdio: 'inherit',
        env,
      });

      // Handle worker process events
      workerProcess.on('error', (error) => {
        console.error('[MetricYak CLI] Failed to start worker:', error);
        process.exit(1);
      });

      workerProcess.on('exit', (code, signal) => {
        if (signal) {
          console.log(`[MetricYak CLI] Worker process was killed with signal ${signal}`);
        } else {
          console.log(`[MetricYak CLI] Worker process exited with code ${code}`);
        }
        process.exit(code ?? 0);
      });

      // Handle graceful shutdown
      const shutdown = () => {
        console.log('[MetricYak CLI] Shutting down worker...');
        workerProcess.kill('SIGTERM');
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    });
}
