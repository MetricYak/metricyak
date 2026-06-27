export function registerShutdown(onShutdown: (signal: string) => Promise<void>): void {
  let shuttingDown = false;
  const handle = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    onShutdown(signal).catch((err) => {
      console.error(JSON.stringify({ level: 'error', msg: 'shutdown error', error: String(err) }));
      process.exit(1);
    });
  };
  process.on('SIGTERM', () => handle('SIGTERM'));
  process.on('SIGINT', () => handle('SIGINT'));
}
