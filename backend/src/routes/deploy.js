const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getConfig } = require('../config/store');
const sshService = require('../services/ssh');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.zip') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos .zip'));
    }
  },
});

// POST /api/deploy/upload
// Receives a ZIP from the browser, SCPs it to the remote server
router.post('/upload', upload.single('release'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  const { environmentId, paseName } = req.body;
  const config = getConfig();
  const envId = environmentId || config.activeEnvironment;
  const env = config.environments.find(e => e.id === envId);

  if (!env) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Ambiente no seleccionado o no configurado' });
  }

  const releaseName = path.basename(req.file.originalname, '.zip');
  const remotePaseDir = `${env.paths.releasesBase}/${paseName || 'Pase' + new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const remoteZipPath = `${remotePaseDir}/${req.file.originalname}`;
  const remoteExtractDir = `${remotePaseDir}/${releaseName}`;

  try {
    // Stream upload progress back if possible; for REST endpoint just await
    await sshService.uploadFile(env, req.file.path, remotePaseDir, req.file.originalname);

    // Extract ZIP on server
    const extractLog = await sshService.execCommand(
      env,
      `mkdir -p "${remoteExtractDir}" && cd "${remotePaseDir}" && unzip -o "${req.file.originalname}" -d "${releaseName}" 2>&1`
    );

    res.json({
      ok: true,
      releaseName,
      remoteZipPath,
      remoteExtractDir,
      remotePaseDir,
      extractLog,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// POST /api/deploy/check-dependencies
// Runs find commands on the server to verify dependencies exist
router.post('/check-dependencies', async (req, res) => {
  const { dependencies, environmentId, searchPath } = req.body;

  if (!Array.isArray(dependencies) || dependencies.length === 0) {
    return res.status(400).json({ error: 'Lista de dependencias requerida' });
  }

  const config = getConfig();
  const envId = environmentId || config.activeEnvironment;
  const env = config.environments.find(e => e.id === envId);
  if (!env) return res.status(400).json({ error: 'Ambiente no configurado' });

  const basePath = searchPath || env.paths.releasesBase || '/SOA/Oracle/AIA';

  try {
    const results = [];
    for (const dep of dependencies) {
      const cmd = `find ${basePath} -name "*${dep}*" 2>/dev/null | head -20`;
      const output = await sshService.execCommand(env, cmd);
      const found = output.trim().length > 0;
      results.push({ dependency: dep, found, output: output.trim() });
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/deploy/run-ant
// Executes the ANT script and returns the full log (streaming handled via WebSocket)
router.post('/run-ant', async (req, res) => {
  const { environmentId, remoteExtractDir, releaseName } = req.body;

  if (!remoteExtractDir || !releaseName) {
    return res.status(400).json({ error: 'remoteExtractDir y releaseName requeridos' });
  }

  const config = getConfig();
  const envId = environmentId || config.activeEnvironment;
  const env = config.environments.find(e => e.id === envId);
  if (!env) return res.status(400).json({ error: 'Ambiente no configurado' });

  const antScript = env.paths.antScript;
  const cmd = `sh "${antScript}" "${remoteExtractDir}" 2>&1`;

  try {
    const output = await sshService.execCommand(env, cmd, { timeout: 600000 });
    const success = output.includes('BUILD SUCCESSFUL');
    const failed = output.includes('BUILD FAILED');

    res.json({
      ok: true,
      success,
      failed,
      output,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, output: err.output || '' });
  }
});

// GET /api/deploy/download-log
// Downloads the ANT log from the server
router.get('/download-log', async (req, res) => {
  const { environmentId, logPath } = req.query;

  const config = getConfig();
  const envId = environmentId || config.activeEnvironment;
  const env = config.environments.find(e => e.id === envId);
  if (!env) return res.status(400).json({ error: 'Ambiente no configurado' });

  try {
    const content = await sshService.readFile(env, logPath);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(logPath)}"`);
    res.send(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
