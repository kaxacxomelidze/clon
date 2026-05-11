import handler from '../server.js';

export default async function (req, res) {
  try {
    await handler(req, res);
  } catch (err) {
    console.error('[CRASH]', err?.message, err?.stack);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error: ' + err?.message + '\n\n' + err?.stack);
    }
  }
}
