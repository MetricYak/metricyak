export function registerShutdown(onShutdown: (signal: string) => Promise<void>): void {
  const handle = (signal: string) => {
    void onShutdown(signal);
  };
  process.on('SIGTERM', () => handle('SIGTERM'));
  process.on('SIGINT', () => handle('SIGINT'));
}
