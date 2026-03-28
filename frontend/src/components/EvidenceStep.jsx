import { useState, useEffect } from 'react';
import api from '../api/client.js';

export default function EvidenceStep({ ctx, updateCtx, onBack }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [form, setForm] = useState({
    installDate: new Date().toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    projectCode: ctx.paseName?.replace(/^Pase\d{8}/, '') || '',
    executedBy: user.username || '',
    environment: user.environment || '',
    status: ctx.antSuccess === false ? 'Fallido' : 'Exitoso',
    comments: 'N/A',
    rfcNumber: ctx.paseName?.replace(/^Pase\d{8}/, '') || '',
    preConditionsOutput: '',
    postConditionsOutput: '',
  });

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    setGenerated(false);

    try {
      const res = await api.post('/documents/ga20002', {
        ...form,
        releaseName: ctx.releaseName,
        dependenciesOutput: ctx.dependenciesOutput || '',
        antOutput: ctx.antOutput || '',
        logContent: ctx.antOutput || '',
        logFileName: `ARCHLOG_${ctx.releaseName}.log`,
      }, { responseType: 'blob' });

      // Trigger download
      const contentDisposition = res.headers['content-disposition'] || '';
      let fileName = `[GA-20-002] - ${ctx.releaseName} - Evidencia instalación.docx`;
      const match = contentDisposition.match(/filename\*=UTF-8''(.+)/);
      if (match) fileName = decodeURIComponent(match[1]);

      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setGenerated(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error generando el documento');
    } finally {
      setGenerating(false);
    }
  }

  const statusOptions = ['Exitoso', 'Fallido'];

  return (
    <div className="p-6 space-y-5">
      <StepHeader
        icon="📄"
        title="Generar Evidencia de Instalación"
        desc="Complete los datos para generar el documento [GA-20-002] de evidencia"
      />

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="bg-gray-800 border border-gray-700 rounded px-2 py-1 font-mono text-gray-300">
          📦 {ctx.releaseName || '—'}
        </span>
        <span className={`rounded px-2 py-1 border font-medium ${
          ctx.antSuccess === false
            ? 'bg-red-900/30 border-red-800 text-red-300'
            : 'bg-green-900/30 border-green-800 text-green-300'
        }`}>
          {ctx.antSuccess === false ? '✗ BUILD FAILED' : '✓ BUILD SUCCESSFUL'}
        </span>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Fecha de instalación *">
          <Input value={form.installDate} onChange={v => setField('installDate', v)} placeholder="21/03/2026" />
        </Field>
        <Field label="Código de proyecto (RFC) *">
          <Input value={form.projectCode} onChange={v => setField('projectCode', v)} placeholder="CAM-TI-2130" />
        </Field>
        <Field label="Ejecutado por *">
          <Input value={form.executedBy} onChange={v => setField('executedBy', v)} placeholder="Nombre del responsable" />
        </Field>
        <Field label="Ambiente *">
          <Input value={form.environment} onChange={v => setField('environment', v)} placeholder="AIA PRD" />
        </Field>
        <Field label="Estado de la instalación *">
          <select
            value={form.status}
            onChange={e => setField('status', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
          >
            {statusOptions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Número de RFC">
          <Input value={form.rfcNumber} onChange={v => setField('rfcNumber', v)} placeholder="CAM-TI-2130" />
        </Field>
      </div>

      <Field label="Comentarios">
        <textarea
          value={form.comments}
          onChange={e => setField('comments', e.target.value)}
          rows={2}
          placeholder="N/A"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
        />
      </Field>

      {/* Additional output sections */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Evidencia adicional (opcional)</p>

        <Field label="Precondiciones y backup (salida de comandos ejecutados antes del despliegue)">
          <textarea
            value={form.preConditionsOutput}
            onChange={e => setField('preConditionsOutput', e.target.value)}
            rows={3}
            placeholder="Pegue aquí la salida de comandos de precondición y backup..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
          />
        </Field>

        <Field label="Postcondiciones (salida de comandos ejecutados después del despliegue)">
          <textarea
            value={form.postConditionsOutput}
            onChange={e => setField('postConditionsOutput', e.target.value)}
            rows={3}
            placeholder="Pegue aquí la salida de comandos de postcondición y verificación..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
          />
        </Field>
      </div>

      {/* Preview of what will be included */}
      <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-4 space-y-2 text-xs">
        <p className="text-gray-400 font-medium">El documento GA-20-002 incluirá:</p>
        <ul className="space-y-1 text-gray-500 list-none">
          <CheckItem label="Tabla INFORMACIÓN GENERAL" done />
          <CheckItem label="Dependencias del release" done={!!ctx.dependenciesOutput} />
          <CheckItem label="Precondiciones y backup" done={!!form.preConditionsOutput} />
          <CheckItem label="Evidencia de instalación (log ANT)" done={!!ctx.antOutput} />
          <CheckItem label="Postcondiciones" done={!!form.postConditionsOutput} />
        </ul>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300">
          <span>⚠️</span> {error}
        </div>
      )}

      {generated && (
        <div className="flex items-center gap-2 bg-green-900/30 border border-green-800 rounded-lg px-4 py-3 text-sm text-green-300">
          <span>✓</span> Documento generado y descargado correctamente.
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
          {generated && (
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-gray-400 hover:text-gray-200 px-4 py-2.5 rounded-lg hover:bg-gray-800 border border-gray-700 transition-colors"
            >
              Nuevo despliegue
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating || !form.installDate || !form.executedBy || !ctx.releaseName}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Generando...
              </>
            ) : generated ? '⬇ Descargar nuevamente' : '📄 Generar GA-20-002'}
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

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, ...rest }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      {...rest}
      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
    />
  );
}

function CheckItem({ label, done }) {
  return (
    <li className={`flex items-center gap-2 ${done ? 'text-green-400' : 'text-gray-600'}`}>
      <span>{done ? '✓' : '○'}</span>
      {label}
    </li>
  );
}
