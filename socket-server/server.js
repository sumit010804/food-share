const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);

const FRONTENDS = (process.env.SOCKET_CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const io = new Server(server, {
  cors: {
    origin: FRONTENDS.length ? FRONTENDS : '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  socket.on('ping', (msg) => {
    socket.emit('pong', msg || 'pong');
  });

  socket.on('disconnect', (reason) => {
    console.log('client disconnected', socket.id, reason);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`socket server listening on ${PORT}`));
