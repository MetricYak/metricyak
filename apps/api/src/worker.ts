import { loadConfig } from './config.js';
import { startWorker } from './worker/start.js';

const config = loadConfig();
await startWorker(config);
