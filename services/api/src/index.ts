import { createServer } from 'node:http';

const port = Number(process.env.API_PORT || 8080);

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true, service: 'api' }));
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on :${port}`);
});
