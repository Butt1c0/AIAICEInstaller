const express = require('express');
const { generateEvidenceDoc } = require('../services/docgen');
const path = require('path');

const router = express.Router();

// POST /api/documents/ga20002
// Generates the [GA-20-002] installation evidence DOCX
router.post('/ga20002', async (req, res) => {
  const {
    installDate,
    projectCode,
    releaseName,
    executedBy,
    environment,
    status,
    comments,
    rfcNumber,
    dependenciesOutput,
    antOutput,
    logFileName,
    logContent,
    preConditionsOutput,
    postConditionsOutput,
  } = req.body;

  if (!releaseName || !environment) {
    return res.status(400).json({ error: 'releaseName y environment son requeridos' });
  }

  try {
    const docBuffer = await generateEvidenceDoc({
      installDate: installDate || new Date().toLocaleDateString('es-CR'),
      projectCode: projectCode || '',
      releaseName,
      executedBy: executedBy || req.user.username,
      environment,
      status: status || 'Exitoso',
      comments: comments || 'N/A',
      rfcNumber: rfcNumber || projectCode || '',
      dependenciesOutput: dependenciesOutput || '',
      antOutput: antOutput || '',
      logFileName: logFileName || '',
      logContent: logContent || '',
      preConditionsOutput: preConditionsOutput || '',
      postConditionsOutput: postConditionsOutput || '',
    });

    const safeRelease = releaseName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `[GA-20-002] - ${safeRelease} - Evidencia instalación_${dateStr}_${environment}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(docBuffer);
  } catch (err) {
    console.error('Error generando documento:', err);
    res.status(500).json({ error: `Error generando documento: ${err.message}` });
  }
});

module.exports = router;
