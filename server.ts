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
  app.disable('x-powered-by');

  const isProd = process.env.NODE_ENV === 'production';
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    const scriptPolicy = isProd
      ? "script-src 'self' https://accounts.google.com https://apis.google.com"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com";
    const frameAncestors = isProd ? "; frame-ancestors 'self'" : '';
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; ${scriptPolicy}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com; connect-src 'self' https://accounts.google.com https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com ws: wss:; frame-src 'self' https://accounts.google.com https://*.firebaseapp.com; object-src 'none'; base-uri 'self'${frameAncestors}`
    );
    if (isProd) {
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  // Serve RFC 9116 security.txt explicitly in Express as well as static Vercel hosting
  app.get('/.well-known/security.txt', (_req, res) => {
    res.type('text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(
      [
        'Contact: mailto:security@dopextention.vercel.app',
        'Expires: 2027-12-31T23:59:00.000Z',
        'Preferred-Languages: en',
        'Canonical: https://dopextention.vercel.app/.well-known/security.txt',
      ].join('\n')
    );
  });

  registerRoutes(app);

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/live' });
  attachLiveWebSocket(wss);

  if (isProd) {
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
