const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getConfig, saveConfig } = require('../config/store');

const router = express.Router();

// GET /api/config — full config
router.get('/', (req, res) => {
  const config = getConfig();
  // Mask SSH passwords before sending
  const safe = {
    ...config,
    environments: config.environments.map(maskEnv),
  };
  res.json(safe);
});

// GET /api/config/environments
router.get('/environments', (req, res) => {
  const { environments, activeEnvironment } = getConfig();
  res.json({ environments: environments.map(maskEnv), activeEnvironment });
});

// POST /api/config/environments — create environment
router.post('/environments', (req, res) => {
  const config = getConfig();
  const env = buildEnv(req.body);
  config.environments.push(env);
  if (!config.activeEnvironment) config.activeEnvironment = env.id;
  saveConfig(config);
  res.status(201).json(maskEnv(env));
});

// PUT /api/config/environments/:id — update environment
router.put('/environments/:id', (req, res) => {
  const config = getConfig();
  const idx = config.environments.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Ambiente no encontrado' });

  // Preserve password if not sent
  const existing = config.environments[idx];
  const updated = buildEnv(req.body, existing);
  updated.id = existing.id;
  config.environments[idx] = updated;
  saveConfig(config);
  res.json(maskEnv(updated));
});

// DELETE /api/config/environments/:id
router.delete('/environments/:id', (req, res) => {
  const config = getConfig();
  const idx = config.environments.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Ambiente no encontrado' });
  config.environments.splice(idx, 1);
  if (config.activeEnvironment === req.params.id) {
    config.activeEnvironment = config.environments[0]?.id || null;
  }
  saveConfig(config);
  res.json({ ok: true });
});

// PUT /api/config/active-environment
router.put('/active-environment', (req, res) => {
  const { id } = req.body;
  const config = getConfig();
  if (!config.environments.find(e => e.id === id)) {
    return res.status(404).json({ error: 'Ambiente no encontrado' });
  }
  config.activeEnvironment = id;
  saveConfig(config);
  res.json({ ok: true });
});

// GET /api/config/environments/:id/full — includes password (admin only, used by backend services)
router.get('/environments/:id/full', (req, res) => {
  const config = getConfig();
  const env = config.environments.find(e => e.id === req.params.id);
  if (!env) return res.status(404).json({ error: 'Ambiente no encontrado' });
  res.json(env);
});

// ── Helpers ────────────────────────────────────────────────────────────────

function buildEnv(body, existing = {}) {
  return {
    id: existing.id || uuidv4(),
    name: body.name || existing.name || '',
    weblogicUrl: body.weblogicUrl || existing.weblogicUrl || '',
    ssh: {
      host: body.ssh?.host || existing.ssh?.host || '',
      port: parseInt(body.ssh?.port) || existing.ssh?.port || 22,
      username: body.ssh?.username || existing.ssh?.username || 'oracle',
      password: body.ssh?.password !== undefined && body.ssh.password !== ''
        ? body.ssh.password
        : (existing.ssh?.password || ''),
      privateKey: body.ssh?.privateKey !== undefined && body.ssh.privateKey !== ''
        ? body.ssh.privateKey
        : (existing.ssh?.privateKey || ''),
    },
    paths: {
      releasesBase: body.paths?.releasesBase || existing.paths?.releasesBase || '/SOA/Oracle/AIA/Pases',
      antScript: body.paths?.antScript || existing.paths?.antScript || '/SOA/Oracle/AIA/BaseScript/ANTScript.sh',
      logsDir: body.paths?.logsDir || existing.paths?.logsDir || '/SOA/Shared/admin/aserver/base_domain/soa/aia/logs',
    },
  };
}

function maskEnv(env) {
  return {
    ...env,
    ssh: {
      ...env.ssh,
      password: env.ssh?.password ? '••••••••' : '',
      privateKey: env.ssh?.privateKey ? '(configurado)' : '',
    },
  };
}

module.exports = router;
