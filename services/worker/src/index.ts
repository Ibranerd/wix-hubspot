const intervalMs = 3000;

setInterval(() => {
  // eslint-disable-next-line no-console
  console.log('[worker] heartbeat');
}, intervalMs);
