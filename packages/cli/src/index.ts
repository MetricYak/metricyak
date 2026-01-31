#!/usr/bin/env node

import { Command } from 'commander';
import { registerWorkerCommand } from './commands/worker.js';

/**
 * Main CLI entry point
 * Defines the 'yak' command and all its subcommands
 */
async function main() {
  const program = new Command();

  program
    .name('yak')
    .description('MetricYak CLI - Developer-first platform for metric-driven workflow automations')
    .version('0.0.0');

  // Register all commands
  registerWorkerCommand(program);

  // Parse command line arguments
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('[MetricYak CLI] Fatal error:', error);
  process.exit(1);
});
