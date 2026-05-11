let handler = null;

export default async function (req, res) {
  try {
    if (!handler) {
      const mod = await import('../server.js');
      handler = mod.default;
    }
    await handler(req, res);
  } catch (err) {
    console.error('[CRASH]', err?.message, err?.stack);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error: ' + (err?.message || err) + '\n\n' + (err?.stack || ''));
    }
  }
}
