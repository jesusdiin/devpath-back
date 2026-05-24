import 'dotenv/config';
import http from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';
import callsRouter from './routes/calls.routes';
import { handleMediaStream } from './websocket/mediaStream.handler';

const app = express();
const PORT = process.env['PORT'] ?? 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/calls', callsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/calls/stream' });
wss.on('connection', handleMediaStream);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket ready at ws://localhost:${PORT}/calls/stream`);
});

process.on('uncaughtException', (err) => console.error('[uncaught]', err));
process.on('unhandledRejection', (err) => console.error('[unhandled]', err));

export default app;
