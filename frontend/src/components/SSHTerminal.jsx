import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

const SSHTerminal = forwardRef(function SSHTerminal({ envId, onStatusChange, readOnly = false }, ref) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);

  useImperativeHandle(ref, () => ({
    write(text) {
      termRef.current?.write(text);
    },
    writeln(text) {
      termRef.current?.writeln(text);
    },
    clear() {
      termRef.current?.clear();
    },
    getOutput() {
      // Returns visible buffer as text (approximate)
      const buf = termRef.current?.buffer?.active;
      if (!buf) return '';
      let result = '';
      for (let i = 0; i < buf.length; i++) {
        result += buf.getLine(i)?.translateToString(true) + '\n';
      }
      return result.trim();
    },
    connect() {
      connectSSH();
    },
    disconnect() {
      wsRef.current?.close();
    },
  }));

  useEffect(() => {
    const term = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        selection: 'rgba(88, 166, 255, 0.2)',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: !readOnly,
      scrollback: 5000,
      convertEol: true,
    });

    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();

    term.loadAddon(fit);
    term.loadAddon(webLinks);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    const resizeObserver = new ResizeObserver(() => fit.fit());
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    if (!readOnly) {
      connectSSH();
    }

    return () => {
      resizeObserver.disconnect();
      wsRef.current?.close();
      term.dispose();
    };
  }, []);

  function connectSSH() {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ token });
    if (envId) params.set('envId', envId);

    const wsUrl = `ws://${window.location.host}/ws/terminal?${params}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const term = termRef.current;

    ws.onopen = () => {
      term.write('\r\n\x1b[32m[Conectando...]\x1b[0m\r\n');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          term.write(msg.data);
        } else if (msg.type === 'status') {
          if (msg.data === 'connected') {
            term.write('\x1b[32m[Conectado]\x1b[0m\r\n');
            onStatusChange?.('connected');
          } else if (msg.data === 'disconnected') {
            term.write('\r\n\x1b[33m[Sesión cerrada]\x1b[0m\r\n');
            onStatusChange?.('disconnected');
          } else if (msg.data === 'connecting') {
            term.write('\r\n\x1b[34m[Estableciendo conexión SSH...]\x1b[0m\r\n');
          }
        } else if (msg.type === 'error') {
          term.write(`\r\n\x1b[31m[Error: ${msg.data}]\x1b[0m\r\n`);
          onStatusChange?.('error');
        }
      } catch {
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      onStatusChange?.('disconnected');
    };

    ws.onerror = () => {
      term.write('\r\n\x1b[31m[Error de conexión WebSocket]\x1b[0m\r\n');
      onStatusChange?.('error');
    };

    if (!readOnly) {
      term.onData(data => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });

      term.onResize(({ rows, cols }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', rows, cols }));
        }
      });
    }
  }

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden"
      style={{ height: '360px', background: '#0d1117' }}
    />
  );
});

export default SSHTerminal;
