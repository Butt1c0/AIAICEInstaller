import { useState } from 'react';
import UploadStep from '../components/UploadStep.jsx';
import DependencyStep from '../components/DependencyStep.jsx';
import AntDeployStep from '../components/AntDeployStep.jsx';
import EvidenceStep from '../components/EvidenceStep.jsx';

const STEPS = [
  { id: 0, label: 'Subir Release', icon: '📦' },
  { id: 1, label: 'Dependencias', icon: '🔍' },
  { id: 2, label: 'Despliegue ANT', icon: '🔧' },
  { id: 3, label: 'Evidencia', icon: '📄' },
];

export default function Deploy() {
  const [step, setStep] = useState(0);
  const [deployContext, setDeployContext] = useState({
    // filled by UploadStep
    releaseName: '',
    remoteExtractDir: '',
    remotePaseDir: '',
    paseName: '',
    environmentId: '',
    // filled by DependencyStep
    dependenciesOutput: '',
    // filled by AntDeployStep
    antOutput: '',
    antSuccess: null,
    logContent: '',
    logFileName: '',
    // filled by EvidenceStep
  });

  function updateCtx(updates) {
    setDeployContext(prev => ({ ...prev, ...updates }));
  }

  function goNext() { setStep(s => Math.min(s + 1, 3)); }
  function goBack() { setStep(s => Math.max(s - 1, 0)); }

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Despliegue de Release</h1>
        <p className="text-gray-400 text-sm mt-0.5">Siga los pasos para instalar un release AIA en el ambiente</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => { if (i <= step) setStep(i); }}
              className={`flex items-center gap-2 group transition-all ${i <= step ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                i < step ? 'bg-green-600 text-white' :
                i === step ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-950' :
                'bg-gray-800 text-gray-500'
              }`}>
                {i < step ? '✓' : s.icon}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${
                i === step ? 'text-blue-400' : i < step ? 'text-green-400' : 'text-gray-500'
              }`}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-3 transition-colors ${i < step ? 'bg-green-600' : 'bg-gray-800'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {step === 0 && (
          <UploadStep
            ctx={deployContext}
            updateCtx={updateCtx}
            onNext={goNext}
          />
        )}
        {step === 1 && (
          <DependencyStep
            ctx={deployContext}
            updateCtx={updateCtx}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {step === 2 && (
          <AntDeployStep
            ctx={deployContext}
            updateCtx={updateCtx}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {step === 3 && (
          <EvidenceStep
            ctx={deployContext}
            updateCtx={updateCtx}
            onBack={goBack}
          />
        )}
      </div>
    </div>
  );
}
