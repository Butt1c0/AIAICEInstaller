const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { getConfig } = require('./config/store');
const sshService = require('./services/ssh');
const authMiddleware = require('./middleware/auth');
const { JWT_SECRET } = require('./middleware/auth');

const authRouter = require('./routes/auth');
const configRouter = require('./routes/config');
const deployRouter = require('./routes/deploy');
const documentsRouter = require('./routes/documents');

const app = express();
const server = http.createServer(app);

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── HTTP Routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/config', authMiddleware, configRouter);
app.use('/api/deploy', authMiddleware, deployRouter);
app.use('/api/documents', authMiddleware, documentsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true, version: '1.0.0' }));

// ── WebSocket Server ───────────────────────────────────────────────────────
// Two types of WS connections:
//   /ws/terminal  — interactive SSH shell (xterm.js)
//   /ws/deploy    — ANT deployment with streamed output

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, 'http://localhost');
  const token = url.searchParams.get('token');

  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const type = url.pathname; // /ws/terminal or /ws/deploy

  if (type === '/ws/terminal') {
    handleTerminalWs(ws, url);
  } else if (type === '/ws/deploy') {
    handleDeployWs(ws, url);
  } else {
    ws.close(4000, 'Unknown endpoint');
  }
});

// ── Terminal WebSocket ─────────────────────────────────────────────────────

function handleTerminalWs(ws, url) {
  const envId = url.searchParams.get('envId');
  const config = getConfig();
  const env = config.environments.find(e => e.id === (envId || config.activeEnvironment));

  if (!env) {
    sendWs(ws, 'error', 'Ambiente no configurado. Configure la conexión SSH primero.');
    ws.close();
    return;
  }

  let sshConn = null;
  let shellStream = null;

  sendWs(ws, 'status', 'connecting');

  sshService.openShell(env)
    .then(({ ssh, stream }) => {
      sshConn = ssh;
      shellStream = stream;

      sendWs(ws, 'status', 'connected');

      stream.on('data', data => {
        sendWs(ws, 'output', data.toString());
      });

      stream.stderr.on('data', data => {
        sendWs(ws, 'output', data.toString());
      });

      stream.on('close', () => {
        sendWs(ws, 'status', 'disconnected');
        ws.close();
      });

      ws.on('message', raw => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'input' && shellStream) {
            shellStream.write(msg.data);
          } else if (msg.type === 'resize' && shellStream) {
            shellStream.setWindow(msg.rows || 24, msg.cols || 80, 0, 0);
          }
        } catch {
          if (shellStream) shellStream.write(raw.toString());
        }
      });

      ws.on('close', () => {
        if (sshConn) sshConn.end();
      });
    })
    .catch(err => {
      sendWs(ws, 'error', `Error de conexión SSH: ${err.message}`);
      ws.close();
    });
}

// ── Deploy WebSocket ───────────────────────────────────────────────────────

function handleDeployWs(ws, url) {
  const envId = url.searchParams.get('envId');
  const config = getConfig();
  const env = config.environments.find(e => e.id === (envId || config.activeEnvironment));

  if (!env) {
    sendWs(ws, 'error', 'Ambiente no configurado');
    ws.close();
    return;
  }

  // Wait for a start message from the client with the command details
  ws.on('message', async raw => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'start') {
        const { remoteExtractDir } = msg;
        if (!remoteExtractDir) {
          sendWs(ws, 'error', 'remoteExtractDir requerido');
          return;
        }

        const antScript = env.paths.antScript;
        const cmd = `sh "${antScript}" "${remoteExtractDir}" 2>&1`;

        sendWs(ws, 'status', 'running');
        sendWs(ws, 'output', `\r\n$ ${cmd}\r\n`);

        try {
          const { output, exitCode } = await sshService.execCommandStreamed(
            env,
            cmd,
            (chunk) => sendWs(ws, 'output', chunk),
            { timeout: 600000 }
          );

          const success = output.includes('BUILD SUCCESSFUL');
          const failed = output.includes('BUILD FAILED') || exitCode !== 0;

          sendWs(ws, 'done', {
            success,
            failed: failed && !success,
            exitCode,
            output,
          });
        } catch (err) {
          sendWs(ws, 'error', err.message);
        }

        ws.close();
      }
    } catch (e) {
      sendWs(ws, 'error', `Mensaje inválido: ${e.message}`);
    }
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sendWs(ws, type, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n  AIA ICE Installer Backend v1.0`);
  console.log(`  Servidor corriendo en http://localhost:${PORT}`);
  console.log(`  WebSocket terminal: ws://localhost:${PORT}/ws/terminal`);
  console.log(`  WebSocket deploy:   ws://localhost:${PORT}/ws/deploy\n`);
});
