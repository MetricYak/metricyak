/**
 * Registers a graceful shutdown callback for SIGTERM and SIGINT.
 * The callback receives the signal name and should close all open
 * handles (HTTP server, BullMQ workers, DB connections, …) then
 * allow the process to exit naturally.
 */
export function registerShutdown(onShutdown: (signal: string) => Promise<void>): void {
  const handle = (signal: string) => {
    void onShutdown(signal);
  };
  process.on('SIGTERM', () => handle('SIGTERM'));
  process.on('SIGINT', () => handle('SIGINT'));
}
