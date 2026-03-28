const { Client } = require('ssh2');
const fs = require('fs');

/**
 * Creates an SSH client and returns it when ready.
 */
function createClient(env) {
  return new Promise((resolve, reject) => {
    const ssh = new Client();
    const sshConfig = buildSshConfig(env);

    ssh.on('ready', () => resolve(ssh));
    ssh.on('error', reject);
    ssh.connect(sshConfig);
  });
}

/**
 * Executes a command and returns its full output.
 */
function execCommand(env, cmd, options = {}) {
  const timeout = options.timeout || 120000;

  return new Promise((resolve, reject) => {
    createClient(env).then(ssh => {
      let output = '';

      ssh.exec(cmd, (err, stream) => {
        if (err) {
          ssh.end();
          return reject(err);
        }

        const timer = setTimeout(() => {
          stream.destroy();
          ssh.end();
          const err2 = new Error(`Comando excedió el tiempo límite (${timeout / 1000}s)`);
          err2.output = output;
          reject(err2);
        }, timeout);

        stream.on('data', data => { output += data.toString(); });
        stream.stderr.on('data', data => { output += data.toString(); });
        stream.on('close', () => {
          clearTimeout(timer);
          ssh.end();
          resolve(output);
        });
      });
    }).catch(reject);
  });
}

/**
 * Executes a command and streams output to a callback.
 * Returns a promise that resolves when the command finishes.
 */
function execCommandStreamed(env, cmd, onData, options = {}) {
  const timeout = options.timeout || 600000;

  return new Promise((resolve, reject) => {
    createClient(env).then(ssh => {
      let output = '';

      ssh.exec(cmd, (err, stream) => {
        if (err) {
          ssh.end();
          return reject(err);
        }

        const timer = setTimeout(() => {
          stream.destroy();
          ssh.end();
          const err2 = new Error(`Comando excedió el tiempo límite (${timeout / 1000}s)`);
          err2.output = output;
          reject(err2);
        }, timeout);

        stream.on('data', data => {
          const chunk = data.toString();
          output += chunk;
          if (onData) onData(chunk, 'stdout');
        });

        stream.stderr.on('data', data => {
          const chunk = data.toString();
          output += chunk;
          if (onData) onData(chunk, 'stderr');
        });

        stream.on('close', (code) => {
          clearTimeout(timer);
          ssh.end();
          resolve({ output, exitCode: code });
        });
      });
    }).catch(reject);
  });
}

/**
 * Uploads a local file to the remote server via SFTP.
 * Creates the remote directory if it does not exist.
 */
function uploadFile(env, localPath, remoteDir, remoteFileName) {
  return new Promise((resolve, reject) => {
    createClient(env).then(ssh => {
      ssh.exec(`mkdir -p "${remoteDir}"`, (err, stream) => {
        if (err) {
          ssh.end();
          return reject(new Error(`Error creando directorio remoto: ${err.message}`));
        }

        stream.on('close', () => {
          ssh.sftp((err2, sftp) => {
            if (err2) {
              ssh.end();
              return reject(new Error(`Error abriendo SFTP: ${err2.message}`));
            }

            const remotePath = `${remoteDir}/${remoteFileName}`;
            sftp.fastPut(localPath, remotePath, {
              chunkSize: 32768,
              concurrency: 64,
            }, (err3) => {
              sftp.end();
              ssh.end();
              if (err3) return reject(new Error(`Error subiendo archivo: ${err3.message}`));
              resolve(remotePath);
            });
          });
        });
      });
    }).catch(reject);
  });
}

/**
 * Reads a remote file and returns its content as a string.
 */
function readFile(env, remotePath) {
  return new Promise((resolve, reject) => {
    createClient(env).then(ssh => {
      ssh.sftp((err, sftp) => {
        if (err) {
          ssh.end();
          return reject(err);
        }

        let content = '';
        const stream = sftp.createReadStream(remotePath);
        stream.on('data', chunk => { content += chunk.toString(); });
        stream.on('end', () => {
          sftp.end();
          ssh.end();
          resolve(content);
        });
        stream.on('error', err2 => {
          sftp.end();
          ssh.end();
          reject(err2);
        });
      });
    }).catch(reject);
  });
}

/**
 * Opens an interactive PTY shell. Used by the WebSocket terminal.
 * Returns { ssh, stream }.
 */
function openShell(env, termOptions = {}) {
  const { rows = 24, cols = 80 } = termOptions;

  return new Promise((resolve, reject) => {
    createClient(env).then(ssh => {
      ssh.shell(
        { term: 'xterm-256color', rows, cols },
        (err, stream) => {
          if (err) {
            ssh.end();
            return reject(err);
          }
          resolve({ ssh, stream });
        }
      );
    }).catch(reject);
  });
}

// ── Internal ─────────────────────────────────────────────────────────────

function buildSshConfig(env) {
  const ssh = env.ssh || {};
  const cfg = {
    host: ssh.host,
    port: ssh.port || 22,
    username: ssh.username || 'oracle',
    readyTimeout: 15000,
    keepaliveInterval: 10000,
  };

  if (ssh.privateKey) {
    try {
      cfg.privateKey = fs.existsSync(ssh.privateKey)
        ? fs.readFileSync(ssh.privateKey)
        : Buffer.from(ssh.privateKey);
      if (ssh.passphrase) cfg.passphrase = ssh.passphrase;
    } catch {
      cfg.password = ssh.password;
    }
  } else {
    cfg.password = ssh.password;
  }

  return cfg;
}

module.exports = { createClient, execCommand, execCommandStreamed, uploadFile, readFile, openShell };
