import { useState, useEffect } from 'react';
import api from '../api/client.js';

const EMPTY_ENV = {
  name: '',
  weblogicUrl: '',
  ssh: { host: '', port: '22', username: 'oracle', password: '', privateKey: '' },
  paths: {
    releasesBase: '/SOA/Oracle/AIA/Pases',
    antScript: '/SOA/Oracle/AIA/BaseScript/ANTScript.sh',
    logsDir: '/SOA/Shared/admin/aserver/base_domain/soa/aia/logs',
  },
};

export default function Config() {
  const [environments, setEnvironments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [editingId, setEditingId] = useState(null); // null = new, string = editing
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    try {
      const res = await api.get('/config/environments');
      setEnvironments(res.data.environments);
      setActiveId(res.data.activeEnvironment);
    } catch (e) {
      setError('Error cargando configuración');
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setEditingId(null);
    setForm(JSON.parse(JSON.stringify(EMPTY_ENV)));
    setError('');
    setSuccess('');
  }

  function startEdit(env) {
    setEditingId(env.id);
    setForm({
      name: env.name,
      weblogicUrl: env.weblogicUrl,
      ssh: {
        host: env.ssh?.host || '',
        port: String(env.ssh?.port || 22),
        username: env.ssh?.username || 'oracle',
        password: '',  // never pre-fill password
        privateKey: '',
      },
      paths: {
        releasesBase: env.paths?.releasesBase || '/SOA/Oracle/AIA/Pases',
        antScript: env.paths?.antScript || '/SOA/Oracle/AIA/BaseScript/ANTScript.sh',
        logsDir: env.paths?.logsDir || '/SOA/Shared/admin/aserver/base_domain/soa/aia/logs',
      },
    });
    setError('');
    setSuccess('');
  }

  function cancelEdit() {
    setForm(null);
    setEditingId(null);
    setError('');
    setSuccess('');
  }

  function setField(path, value) {
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/config/environments/${editingId}`, form);
        setSuccess('Ambiente actualizado correctamente');
      } else {
        await api.post('/config/environments', form);
        setSuccess('Ambiente creado correctamente');
      }
      await loadConfig();
      cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || 'Error guardando configuración');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este ambiente?')) return;
    try {
      await api.delete(`/config/environments/${id}`);
      await loadConfig();
      if (editingId === id) cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || 'Error eliminando ambiente');
    }
  }

  async function handleSetActive(id) {
    try {
      await api.put('/config/active-environment', { id });
      setActiveId(id);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const env = environments.find(e => e.id === id);
      if (env) {
        localStorage.setItem('user', JSON.stringify({ ...user, environment: env.name }));
      }
    } catch (err) {
      setError('Error cambiando ambiente activo');
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-400">
        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Cargando configuración...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Configuración de Ambientes</h1>
          <p className="text-gray-400 text-sm mt-0.5">Gestione las conexiones SSH y parámetros de cada ambiente</p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <span>+</span> Nuevo Ambiente
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300">
          <span>⚠️</span> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 bg-green-900/30 border border-green-800 rounded-lg px-4 py-3 text-sm text-green-300">
          <span>✓</span> {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Environment list */}
        <div className="space-y-2">
          {environments.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8 bg-gray-900 rounded-xl border border-gray-800">
              No hay ambientes configurados.<br />
              <button onClick={startNew} className="text-blue-400 hover:underline mt-1">
                Crear uno ahora
              </button>
            </div>
          )}
          {environments.map(env => (
            <div
              key={env.id}
              className={`bg-gray-900 border rounded-xl p-4 cursor-pointer transition-all ${
                editingId === env.id ? 'border-blue-500' : 'border-gray-800 hover:border-gray-700'
              }`}
              onClick={() => startEdit(env)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-white truncate">{env.name}</span>
                    {activeId === env.id && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-900/50 text-green-400 border border-green-800 whitespace-nowrap">
                        activo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{env.ssh?.host || '—'}</p>
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  {activeId !== env.id && (
                    <button
                      onClick={e => { e.stopPropagation(); handleSetActive(env.id); }}
                      title="Activar"
                      className="p-1 text-gray-500 hover:text-green-400 transition-colors text-xs"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(env.id); }}
                    title="Eliminar"
                    className="p-1 text-gray-500 hover:text-red-400 transition-colors text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Edit form */}
        {form && (
          <form onSubmit={handleSave} className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
            <h2 className="text-sm font-semibold text-white">
              {editingId ? 'Editar ambiente' : 'Nuevo ambiente'}
            </h2>

            {/* General */}
            <Section title="General">
              <Field label="Nombre del ambiente *" hint="Ej: Desarrollo, QA, PrePRD, PRD">
                <Input value={form.name} onChange={v => setField('name', v)} required placeholder="PRD" />
              </Field>
              <Field label="URL de WebLogic Admin *" hint="Para autenticación de usuarios">
                <Input value={form.weblogicUrl} onChange={v => setField('weblogicUrl', v)} required placeholder="http://adminprd:7001" />
              </Field>
            </Section>

            {/* SSH */}
            <Section title="Conexión SSH">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Host *">
                  <Input value={form.ssh.host} onChange={v => setField('ssh.host', v)} required placeholder="lnxprdsoaaia01" />
                </Field>
                <Field label="Puerto">
                  <Input value={form.ssh.port} onChange={v => setField('ssh.port', v)} placeholder="22" type="number" />
                </Field>
              </div>
              <Field label="Usuario SSH *" hint="Usuario para despliegues (normalmente oracle)">
                <Input value={form.ssh.username} onChange={v => setField('ssh.username', v)} required placeholder="oracle" />
              </Field>
              <Field label="Contraseña" hint={editingId ? 'Dejar en blanco para mantener la actual' : ''}>
                <Input value={form.ssh.password} onChange={v => setField('ssh.password', v)} type="password" placeholder="••••••••" autoComplete="new-password" />
              </Field>
              <Field label="Clave privada (ruta o contenido PEM)" hint="Opcional si usa contraseña">
                <textarea
                  value={form.ssh.privateKey}
                  onChange={e => setField('ssh.privateKey', e.target.value)}
                  rows={3}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY----- ..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </Field>
            </Section>

            {/* Paths */}
            <Section title="Rutas en el servidor">
              <Field label="Directorio base de releases *">
                <Input value={form.paths.releasesBase} onChange={v => setField('paths.releasesBase', v)} required placeholder="/SOA/Oracle/AIA/Pases" />
              </Field>
              <Field label="Ruta del script ANT *">
                <Input value={form.paths.antScript} onChange={v => setField('paths.antScript', v)} required placeholder="/SOA/Oracle/AIA/BaseScript/ANTScript.sh" />
              </Field>
              <Field label="Directorio de logs">
                <Input value={form.paths.logsDir} onChange={v => setField('paths.logsDir', v)} placeholder="/SOA/Shared/admin/aserver/base_domain/soa/aia/logs" />
              </Field>
            </Section>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">
        {label}
        {hint && <span className="text-gray-600 font-normal ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = 'text', ...rest }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      {...rest}
      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
    />
  );
}
