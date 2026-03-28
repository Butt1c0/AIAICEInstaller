import { useState, useEffect } from 'react';
import api from '../api/client.js';

export default function UploadStep({ ctx, updateCtx, onNext }) {
  const [environments, setEnvironments] = useState([]);
  const [envId, setEnvId] = useState('');
  const [paseName, setPaseName] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLog, setUploadLog] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get('/config/environments').then(res => {
      setEnvironments(res.data.environments);
      const active = res.data.activeEnvironment;
      setEnvId(ctx.environmentId || active || '');
    });
    // Default pase name from today's date
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    setPaseName(ctx.paseName || `Pase${today}`);
  }, []);

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setDone(false);
      setUploadLog('');
      setError('');
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');
    setUploadLog('');

    const formData = new FormData();
    formData.append('release', file);
    formData.append('environmentId', envId);
    formData.append('paseName', paseName);

    try {
      setUploadLog(`Subiendo ${file.name}...\n`);
      const res = await api.post('/deploy/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
        onUploadProgress: (e) => {
          if (e.total) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadLog(`Transfiriendo... ${pct}%\n`);
          }
        },
      });

      const { releaseName, remoteExtractDir, remotePaseDir, extractLog } = res.data;
      setUploadLog(prev =>
        prev +
        `\n✓ Archivo subido exitosamente\n` +
        `  ZIP: ${remotePaseDir}/${file.name}\n` +
        `  Extraído en: ${remoteExtractDir}\n\n` +
        (extractLog ? `Extracción:\n${extractLog}\n` : '')
      );

      updateCtx({
        releaseName,
        remoteExtractDir,
        remotePaseDir,
        paseName,
        environmentId: envId,
      });
      setDone(true);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      setUploadLog(prev => prev + `\n✗ Error: ${msg}\n`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <StepHeader
        icon="📦"
        title="Subir Release"
        desc="Seleccione el archivo ZIP del release y cárguelo al servidor remoto"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ambiente */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Ambiente de destino *</label>
          <select
            value={envId}
            onChange={e => setEnvId(e.target.value)}
            disabled={uploading || done}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
          >
            <option value="">— Seleccionar —</option>
            {environments.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        {/* Pase name */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Nombre del Pase *
            <span className="text-gray-600 font-normal ml-1">— carpeta en el servidor</span>
          </label>
          <input
            type="text"
            value={paseName}
            onChange={e => setPaseName(e.target.value)}
            disabled={uploading || done}
            placeholder="Pase20260321CAM-TI-2130"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* File picker */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Archivo de Release (.zip) *</label>
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
            file ? 'border-blue-600 bg-blue-900/10' : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          {file ? (
            <div className="space-y-1">
              <p className="text-2xl">📦</p>
              <p className="text-sm font-medium text-gray-200">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              {!uploading && !done && (
                <button
                  onClick={() => { setFile(null); setUploadLog(''); setError(''); }}
                  className="text-xs text-gray-500 hover:text-gray-300 underline mt-1"
                >
                  cambiar archivo
                </button>
              )}
            </div>
          ) : (
            <label className="cursor-pointer block">
              <input type="file" accept=".zip" onChange={handleFileChange} className="hidden" />
              <p className="text-3xl mb-2">📂</p>
              <p className="text-sm text-gray-400">Haga clic para seleccionar un archivo <span className="text-blue-400">.zip</span></p>
              <p className="text-xs text-gray-600 mt-1">Máximo 500 MB</p>
            </label>
          )}
        </div>
      </div>

      {/* Log console */}
      {uploadLog && (
        <div className="rounded-lg overflow-hidden border border-gray-800">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 border-b border-gray-800">
            <span className="text-xs text-gray-400">Consola</span>
            <div className="ml-auto flex gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500/60" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
              <div className="w-2 h-2 rounded-full bg-green-500/60" />
            </div>
          </div>
          <pre className="log-output bg-terminal-bg text-terminal-text p-4 max-h-56 overflow-auto text-xs">
            {uploadLog}
          </pre>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <div />
        {done ? (
          <button
            onClick={onNext}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Continuar a Dependencias →
          </button>
        ) : (
          <button
            onClick={handleUpload}
            disabled={!file || !envId || !paseName || uploading}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Subiendo...
              </>
            ) : '⬆ Subir al servidor'}
          </button>
        )}
      </div>
    </div>
  );
}

function StepHeader({ icon, title, desc }) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-gray-800">
      <div className="text-2xl">{icon}</div>
      <div>
        <h2 className="font-semibold text-white">{title}</h2>
        <p className="text-gray-400 text-sm">{desc}</p>
      </div>
    </div>
  );
}
