# AIA ICE Installer v1.0

Aplicación web para la instalación y despliegue de releases AIA en ambientes WebLogic 12c (SOA + AIA) sobre Linux.

## Requisitos

- Node.js 18+
- npm 9+
- Acceso SSH al servidor WebLogic (usuario `oracle` o el configurado)
- Credenciales de administrador WebLogic para el login

## Instalación

```bash
# Instalar dependencias de backend y frontend
cd backend && npm install
cd ../frontend && npm install
```

## Ejecución en desarrollo

```bash
# Terminal 1 — Backend (puerto 3001)
cd backend && npm run dev

# Terminal 2 — Frontend (puerto 5173)
cd frontend && npm run dev
```

Abrir: http://localhost:5173

## Flujo de despliegue

1. **Login** — credenciales de administrador WebLogic
2. **Configuración** — configure el ambiente (SSH, rutas, URL WebLogic)
3. **Subir Release** — seleccione el ZIP y súbalo al servidor vía SFTP
4. **Dependencias** — verifique las dependencias en el servidor
5. **Despliegue ANT** — ejecute el script ANT con salida en vivo
6. **Evidencia** — genere el documento `[GA-20-002]` de evidencia de instalación

## Estructura

```
AIAICEInstaller/
├── backend/          Node.js + Express + WebSocket + ssh2
│   └── src/
│       ├── index.js          Servidor principal + WebSocket
│       ├── routes/           auth, config, deploy, documents
│       ├── services/         ssh.js, docgen.js
│       └── middleware/       auth.js (JWT)
└── frontend/         React + Vite + Tailwind CSS + xterm.js
    └── src/
        ├── pages/            Login, Config, Deploy
        └── components/       UploadStep, DependencyStep, AntDeployStep, EvidenceStep
```

## Configuración de ambientes

Cada ambiente requiere:
- **Nombre**: identificador (ej. PRD, QA, Desarrollo)
- **URL WebLogic**: para autenticación (ej. `http://adminprd:7001`)
- **SSH Host/Port/User/Password**: conexión al servidor Linux
- **Rutas**: directorio base de releases, script ANT, logs

La configuración se almacena en `backend/data/config.json` (excluido de git).
