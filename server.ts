import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { attachLiveWebSocket } from './server/geminiService';
import { registerRoutes } from './server/routes';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  registerRoutes(app);

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/live' });
  attachLiveWebSocket(wss);

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`DOPE server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start DOPE server:', err);
  process.exit(1);
});
