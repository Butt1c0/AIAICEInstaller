const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { getConfig } = require('../config/store');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
// Validates credentials against the configured WebLogic admin URL
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const config = getConfig();
  const activeEnvId = config.activeEnvironment;
  const activeEnv = config.environments.find(e => e.id === activeEnvId);

  if (!activeEnv || !activeEnv.weblogicUrl) {
    return res.status(503).json({
      error: 'No hay un ambiente configurado. Configure primero un ambiente en la pantalla de configuración.'
    });
  }

  try {
    // Try to authenticate against the WebLogic REST Management API
    const mgmtUrl = `${activeEnv.weblogicUrl}/management/weblogic/latest/domainRuntime`;
    await axios.get(mgmtUrl, {
      auth: { username, password },
      timeout: 10000,
      validateStatus: (status) => status === 200,
    });

    const token = jwt.sign(
      { username, role: 'admin', envId: activeEnvId },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, username, environment: activeEnv.name });
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 401 || status === 403) {
        return res.status(401).json({ error: 'Credenciales inválidas o usuario sin permisos de administrador' });
      }
      return res.status(502).json({ error: `Error al conectar con WebLogic: HTTP ${status}` });
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
      return res.status(502).json({ error: `No se puede conectar a WebLogic en ${activeEnv.weblogicUrl}` });
    }
    return res.status(502).json({ error: `Error de conexión: ${err.message}` });
  }
});

// POST /api/auth/logout  (client just discards the token, but endpoint for completeness)
router.post('/logout', (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
