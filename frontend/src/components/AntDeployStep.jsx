import { useState, useRef, useEffect } from 'react';

export default function AntDeployStep({ ctx, updateCtx, onNext, onBack }) {
  const [status, setStatus] = useState('idle'); // idle | running | success | failed
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const logRef = useRef(null);
  const wsRef = useRef(null);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [output]);

  function startDeploy() {
    if (!ctx.remoteExtractDir) {
      setError('No hay release cargado. Vuelva al paso anterior.');
      return;
    }

    setStatus('running');
    setOutput('');
    setError('');

    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ token });
    if (ctx.environmentId) params.set('envId', ctx.environmentId);

    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${wsProto}://${window.location.host}/aiaice/ws/deploy?${params}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'start',
        remoteExtractDir: ctx.remoteExtractDir,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          setOutput(prev => prev + msg.data);
        } else if (msg.type === 'status' && msg.data === 'running') {
          setOutput(prev => prev + '--- Iniciando despliegue ANT ---\n\n');
        } else if (msg.type === 'done') {
          const { success, failed, output: fullOutput } = msg.data;
          setStatus(success ? 'success' : 'failed');
          updateCtx({
            antOutput: fullOutput,
            antSuccess: success,
          });
        } else if (msg.type === 'error') {
          setError(msg.data);
          setStatus('failed');
        }
      } catch {
        setOutput(prev => prev + event.data);
      }
    };

    ws.onclose = () => {
      if (status === 'running') setStatus('idle');
    };

    ws.onerror = () => {
      setError('Error en la conexión WebSocket');
      setStatus('failed');
    };
  }

  function stopDeploy() {
    wsRef.current?.close();
    setStatus('idle');
  }

  async function handleDownloadLog() {
    if (!ctx.antOutput) return;
    const blob = new Blob([ctx.antOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ARCHLOG_${ctx.releaseName || 'deployment'}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusColor = {
    idle: 'text-gray-400',
    running: 'text-yellow-400',
    success: 'text-green-400',
    failed: 'text-red-400',
  }[status];

  const statusText = {
    idle: 'Listo para ejecutar',
    running: 'Ejecutando...',
    success: 'BUILD SUCCESSFUL',
    failed: 'BUILD FAILED',
  }[status];

  // Colorize ANT output
  function colorizeOutput(text) {
    return text
      .split('\n')
      .map((line, i) => {
        let cls = 'text-terminal-text';
        if (line.includes('BUILD SUCCESSFUL')) cls = 'text-green-400 font-bold';
        else if (line.includes('BUILD FAILED')) cls = 'text-red-400 font-bold';
        else if (line.startsWith('[echo]') || line.includes('[exec]')) cls = 'text-blue-300';
        else if (line.startsWith('[mkdir]') || line.startsWith('[copy]') || line.startsWith('[zip]')) cls = 'text-cyan-300';
        else if (line.startsWith('[delete]')) cls = 'text-yellow-300';
        else if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) cls = 'text-red-300';
        else if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('warn')) cls = 'text-yellow-300';
        else if (line.startsWith('$')) cls = 'text-green-300';
        return <div key={i} className={cls}>{line || '\u00a0'}</div>;
      });
  }

  return (
    <div className="p-6 space-y-5">
      <StepHeader
        icon="🔧"
        title="Despliegue ANT"
        desc="Ejecute el script ANT para instalar el release en el servidor"
      />

      {/* Context info */}
      <div className="bg-gray-800/50 rounded-lg px-4 py-3 space-y-1.5 text-xs font-mono">
        <div><span className="text-gray-500">Release: </span><span className="text-blue-300">{ctx.releaseName || '—'}</span></div>
        <div><span className="text-gray-500">Ruta: </span><span className="text-blue-300">{ctx.remoteExtractDir || '—'}</span></div>
      </div>

      {/* ANT command preview */}
      <div className="bg-terminal-bg rounded-lg border border-terminal-border px-4 py-3">
        <p className="text-xs text-gray-500 mb-1">Comando a ejecutar:</p>
        <p className="text-xs font-mono text-green-300">
          sh &quot;{ctx.antScript || '/SOA/Oracle/AIA/BaseScript/ANTScript.sh'}&quot; &quot;{ctx.remoteExtractDir || '<ruta_release>'}&quot; 2&amp;&gt;1
        </p>
      </div>

      {/* Status badge */}
      {status !== 'idle' && (
        <div className={`flex items-center gap-2 text-sm font-medium ${statusColor}`}>
          {status === 'running' && (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
          {status === 'success' && <span>✓</span>}
          {status === 'failed' && <span>✗</span>}
          {statusText}
        </div>
      )}

      {/* Log console */}
      <div className="rounded-lg overflow-hidden border border-terminal-border">
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800/60 border-b border-terminal-border">
          <span className="text-xs text-gray-400">Log de despliegue</span>
          <div className="flex items-center gap-2">
            {output && status !== 'running' && (
              <button
                onClick={handleDownloadLog}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                ⬇ Descargar log
              </button>
            )}
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500/60" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
              <div className="w-2 h-2 rounded-full bg-green-500/60" />
            </div>
          </div>
        </div>
        <div
          ref={logRef}
          className="log-output bg-terminal-bg text-terminal-text p-4 h-80 overflow-auto text-xs"
        >
          {output ? colorizeOutput(output) : (
            <span className="text-terminal-muted">Haga clic en &quot;Ejecutar Despliegue&quot; para iniciar...</span>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          disabled={status === 'running'}
          className="text-sm text-gray-400 hover:text-gray-200 px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
        >
          ← Volver
        </button>
        <div className="flex gap-3">
          {status === 'running' ? (
            <button
              onClick={stopDeploy}
              className="flex items-center gap-2 bg-red-800 hover:bg-red-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              ⏹ Detener
            </button>
          ) : (
            <>
              {status === 'idle' || status === 'failed' ? (
                <button
                  onClick={startDeploy}
                  disabled={!ctx.remoteExtractDir}
                  className="flex items-center gap-2 bg-orange-700 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  ▶ Ejecutar Despliegue ANT
                </button>
              ) : null}
              {(status === 'success' || status === 'failed') && (
                <button
                  onClick={onNext}
                  className={`flex items-center gap-2 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors ${
                    status === 'success'
                      ? 'bg-blue-600 hover:bg-blue-500'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  Continuar a Evidencia →
                </button>
              )}
            </>
          )}
        </div>
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
