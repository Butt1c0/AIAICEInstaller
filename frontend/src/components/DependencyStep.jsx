import { useState } from 'react';
import api from '../api/client.js';

export default function DependencyStep({ ctx, updateCtx, onNext, onBack }) {
  const [deps, setDeps] = useState([{ name: '' }]);
  const [searchPath, setSearchPath] = useState('/SOA/Oracle/AIA');
  const [results, setResults] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState('');

  function addDep() { setDeps(d => [...d, { name: '' }]); }
  function removeDep(i) { setDeps(d => d.filter((_, j) => j !== i)); }
  function setDepName(i, v) {
    setDeps(d => d.map((dep, j) => j === i ? { ...dep, name: v } : dep));
  }

  async function handleCheck() {
    const depNames = deps.map(d => d.name.trim()).filter(Boolean);
    if (depNames.length === 0) return;

    setChecking(true);
    setError('');
    setResults(null);
    setOutput('');

    try {
      const res = await api.post('/deploy/check-dependencies', {
        dependencies: depNames,
        environmentId: ctx.environmentId,
        searchPath,
      });

      setResults(res.data.results);

      // Build output text for document
      let out = `Búsqueda de dependencias en ${searchPath}\n`;
      out += `Fecha: ${new Date().toLocaleString('es-CR')}\n\n`;
      for (const r of res.data.results) {
        out += `$ find ${searchPath} -name "*${r.dependency}*" 2>/dev/null\n`;
        out += r.output || '(no se encontraron resultados)\n';
        out += '\n';
      }
      setOutput(out);
      updateCtx({ dependenciesOutput: out });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setChecking(false);
    }
  }

  const allFound = results && results.length > 0 && results.every(r => r.found);
  const hasResults = results !== null;

  return (
    <div className="p-6 space-y-5">
      <StepHeader
        icon="🔍"
        title="Verificación de Dependencias"
        desc="Busque dependencias requeridas en el servidor antes de desplegar"
      />

      <div className="text-xs text-gray-400 bg-gray-800/50 rounded-lg px-3 py-2 font-mono">
        Release: <span className="text-blue-300">{ctx.releaseName || '—'}</span>
        {' · '}
        Pase: <span className="text-blue-300">{ctx.paseName || '—'}</span>
      </div>

      {/* Search path */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">
          Ruta base de búsqueda
        </label>
        <input
          type="text"
          value={searchPath}
          onChange={e => setSearchPath(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 focus:outline-none focus:border-blue-500"
          placeholder="/SOA/Oracle/AIA"
        />
      </div>

      {/* Dependency list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-400">Dependencias a verificar</label>
          <button
            onClick={addDep}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <span>+</span> agregar
          </button>
        </div>

        {deps.map((dep, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="text-gray-600 text-xs font-mono w-4 text-right shrink-0">{i + 1}.</span>
            <input
              type="text"
              value={dep.name}
              onChange={e => setDepName(i, e.target.value)}
              placeholder="Nombre o patrón (ej: ProcessPrepaidPackage)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
            {deps.length > 1 && (
              <button
                onClick={() => removeDep(i)}
                className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Command preview */}
      <div className="bg-gray-800/50 rounded-lg px-3 py-2 text-xs font-mono text-gray-500">
        {deps.filter(d => d.name.trim()).map((d, i) => (
          <div key={i}>find {searchPath} -name &quot;*{d.name.trim()}*&quot; 2&gt;/dev/null</div>
        ))}
        {deps.filter(d => d.name.trim()).length === 0 && <span>Ingrese dependencias para ver el comando</span>}
      </div>

      {/* Results */}
      {hasResults && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`rounded-lg border overflow-hidden ${
                r.found ? 'border-green-800/50' : 'border-red-800/50'
              }`}
            >
              <div className={`flex items-center gap-2 px-3 py-2 text-sm ${
                r.found ? 'bg-green-900/20 text-green-300' : 'bg-red-900/20 text-red-300'
              }`}>
                <span>{r.found ? '✓' : '✗'}</span>
                <span className="font-mono">{r.dependency}</span>
                <span className="ml-auto text-xs opacity-70">
                  {r.found ? 'encontrado' : 'no encontrado'}
                </span>
              </div>
              {r.output && (
                <pre className="log-output bg-terminal-bg text-terminal-text p-3 text-xs max-h-28 overflow-auto">
                  {r.output}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-gray-200 px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
        >
          ← Volver
        </button>
        <div className="flex gap-3">
          <button
            onClick={handleCheck}
            disabled={checking || deps.every(d => !d.name.trim())}
            className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {checking ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Verificando...
              </>
            ) : '🔍 Verificar dependencias'}
          </button>
          <button
            onClick={onNext}
            disabled={!hasResults}
            className={`flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors ${
              allFound
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : hasResults
                  ? 'bg-yellow-700 hover:bg-yellow-600 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {allFound
              ? 'Continuar al Despliegue →'
              : hasResults
                ? 'Continuar de todas formas →'
                : 'Continuar →'}
          </button>
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
