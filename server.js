const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

// HTTP-сервер, который ничего не отдаёт по обычным запросам
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
});

// WebSocket-сервер поверх HTTP — принимает любые пути
const wss = new WebSocketServer({ server });

const clients = new Map();
const admins = new Set();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const role = url.searchParams.get('role');
  const id   = url.searchParams.get('id') || Math.random().toString(36).slice(2, 8);

  console.log('[connection] role=' + role + ' id=' + id);

  if (role === 'admin') {
    admins.add(ws);
    console.log('[admin] connected');
    ws.send(JSON.stringify({ type: 'list', clients: [...clients.keys()] }));

    ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw);
        if (msg.target && clients.has(msg.target)) {
          clients.get(msg.target).send(raw.toString());
        }
      } catch (e) { console.error(e); }
    });

    ws.on('close', () => { admins.delete(ws); console.log('[admin] closed'); });
    return;
  }

  clients.set(id, ws);
  console.log('[client] connected id=' + id);
  broadcastToAdmins({ type: 'online', id });

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      broadcastToAdmins({ ...msg, from: id });
    } catch (e) { console.error(e); }
  });

  ws.on('close', () => {
    clients.delete(id);
    console.log('[client] closed id=' + id);
    broadcastToAdmins({ type: 'offline', id });
  });
});

function broadcastToAdmins(obj) {
  const s = JSON.stringify(obj);
  for (const a of admins) if (a.readyState === 1) a.send(s);
}

server.listen(PORT, () => {
  console.log('Server on port ' + PORT);
});
