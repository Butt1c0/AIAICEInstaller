package cr.go.ice.aia.installer.service;

import com.jcraft.jsch.*;
import cr.go.ice.aia.installer.model.Environment;

import java.io.*;
import java.util.Properties;
import java.util.function.Consumer;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Provides SSH/SFTP operations using JSch.
 */
public class SSHService {

    private static final Logger LOG = Logger.getLogger(SSHService.class.getName());

    private SSHService() {}

    /**
     * Creates a connected JSch Session for the given environment.
     */
    public static Session createSession(Environment env) throws JSchException {
        Environment.SshConfig ssh = env.getSsh();
        JSch jsch = new JSch();

        // Private key auth
        if (ssh.getPrivateKey() != null && !ssh.getPrivateKey().isEmpty()) {
            try {
                File keyFile = new File(ssh.getPrivateKey());
                if (keyFile.exists()) {
                    jsch.addIdentity(keyFile.getAbsolutePath());
                } else {
                    // Treat as inline PEM content
                    jsch.addIdentity("inline-key", ssh.getPrivateKey().getBytes(), null, null);
                }
            } catch (Exception e) {
                LOG.log(Level.WARNING, "Error loading private key, falling back to password", e);
            }
        }

        Session session = jsch.getSession(ssh.getUsername(), ssh.getHost(), ssh.getPort());

        if (ssh.getPassword() != null && !ssh.getPassword().isEmpty()) {
            session.setPassword(ssh.getPassword());
        }

        Properties config = new Properties();
        config.put("StrictHostKeyChecking", "no");
        session.setConfig(config);
        session.setTimeout(15000);
        session.connect();

        return session;
    }

    /**
     * Executes a command and returns its full output.
     */
    public static String execCommand(Environment env, String command, long timeoutMs) throws Exception {
        Session session = createSession(env);
        try {
            ChannelExec channel = (ChannelExec) session.openChannel("exec");
            channel.setCommand(command);
            channel.setInputStream(null);
            channel.setErrStream(System.err);

            InputStream in = channel.getInputStream();
            InputStream err = channel.getExtInputStream();
            channel.connect();

            StringBuilder output = new StringBuilder();
            byte[] buf = new byte[4096];
            long start = System.currentTimeMillis();

            while (true) {
                while (in.available() > 0) {
                    int len = in.read(buf);
                    if (len > 0) output.append(new String(buf, 0, len));
                }
                while (err.available() > 0) {
                    int len = err.read(buf);
                    if (len > 0) output.append(new String(buf, 0, len));
                }
                if (channel.isClosed()) break;
                if (System.currentTimeMillis() - start > timeoutMs) {
                    channel.disconnect();
                    throw new RuntimeException("Comando excedió el tiempo límite (" + (timeoutMs / 1000) + "s)");
                }
                Thread.sleep(100);
            }

            channel.disconnect();
            return output.toString();
        } finally {
            session.disconnect();
        }
    }

    /**
     * Executes a command and streams output to a callback.
     */
    public static String execCommandStreamed(Environment env, String command,
                                              Consumer<String> onData, long timeoutMs) throws Exception {
        Session session = createSession(env);
        try {
            ChannelExec channel = (ChannelExec) session.openChannel("exec");
            channel.setCommand(command);
            channel.setInputStream(null);

            InputStream in = channel.getInputStream();
            InputStream err = channel.getExtInputStream();
            channel.connect();

            StringBuilder output = new StringBuilder();
            byte[] buf = new byte[4096];
            long start = System.currentTimeMillis();

            while (true) {
                while (in.available() > 0) {
                    int len = in.read(buf);
                    if (len > 0) {
                        String chunk = new String(buf, 0, len);
                        output.append(chunk);
                        if (onData != null) onData.accept(chunk);
                    }
                }
                while (err.available() > 0) {
                    int len = err.read(buf);
                    if (len > 0) {
                        String chunk = new String(buf, 0, len);
                        output.append(chunk);
                        if (onData != null) onData.accept(chunk);
                    }
                }
                if (channel.isClosed()) break;
                if (System.currentTimeMillis() - start > timeoutMs) {
                    channel.disconnect();
                    throw new RuntimeException("Comando excedió el tiempo límite");
                }
                Thread.sleep(50);
            }

            channel.disconnect();
            return output.toString();
        } finally {
            session.disconnect();
        }
    }

    /**
     * Uploads a local file to a remote path via SFTP.
     */
    public static void uploadFile(Environment env, File localFile,
                                   String remoteDir, String remoteFileName) throws Exception {
        Session session = createSession(env);
        try {
            // Create remote directory
            ChannelExec mkdirCh = (ChannelExec) session.openChannel("exec");
            mkdirCh.setCommand("mkdir -p \"" + remoteDir + "\"");
            mkdirCh.connect();
            while (!mkdirCh.isClosed()) Thread.sleep(50);
            mkdirCh.disconnect();

            // SFTP upload
            ChannelSftp sftp = (ChannelSftp) session.openChannel("sftp");
            sftp.connect();
            sftp.cd(remoteDir);
            try (FileInputStream fis = new FileInputStream(localFile)) {
                sftp.put(fis, remoteFileName, ChannelSftp.OVERWRITE);
            }
            sftp.disconnect();
        } finally {
            session.disconnect();
        }
    }

    /**
     * Reads a remote file and returns its content.
     */
    public static String readRemoteFile(Environment env, String remotePath) throws Exception {
        Session session = createSession(env);
        try {
            ChannelSftp sftp = (ChannelSftp) session.openChannel("sftp");
            sftp.connect();
            try (InputStream in = sftp.get(remotePath)) {
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                byte[] buf = new byte[4096];
                int len;
                while ((len = in.read(buf)) != -1) baos.write(buf, 0, len);
                return baos.toString("UTF-8");
            } finally {
                sftp.disconnect();
            }
        } finally {
            session.disconnect();
        }
    }

    /**
     * Opens an interactive shell channel. Caller is responsible for disconnecting.
     */
    public static ChannelShell openShell(Session session, int rows, int cols) throws JSchException {
        ChannelShell shell = (ChannelShell) session.openChannel("shell");
        shell.setPtyType("xterm-256color");
        shell.setPtySize(cols, rows, 0, 0);
        shell.connect();
        return shell;
    }
}
