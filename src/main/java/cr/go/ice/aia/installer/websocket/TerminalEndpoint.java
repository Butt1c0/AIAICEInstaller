package cr.go.ice.aia.installer.websocket;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.jcraft.jsch.ChannelShell;
import com.jcraft.jsch.Session;
import cr.go.ice.aia.installer.model.Environment;
import cr.go.ice.aia.installer.service.ConfigService;
import cr.go.ice.aia.installer.service.SSHService;
import cr.go.ice.aia.installer.util.JwtUtil;

import javax.websocket.*;
import javax.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * WebSocket endpoint for interactive SSH terminal (xterm.js).
 * URL: /ws/terminal?token=JWT&envId=xxx
 */
@ServerEndpoint(value = "/ws/terminal", configurator = WsAuthConfigurator.class)
public class TerminalEndpoint {

    private static final Logger LOG = Logger.getLogger(TerminalEndpoint.class.getName());
    private static final Gson GSON = new Gson();

    private Session sshSession;
    private ChannelShell shell;
    private OutputStream shellInput;
    private Thread readerThread;

    @OnOpen
    public void onOpen(javax.websocket.Session wsSession, EndpointConfig config) {
        Map<String, Object> props = config.getUserProperties();
        String envId = (String) props.get("envId");

        Environment env = ConfigService.getInstance().resolveEnvironment(envId);
        if (env == null || env.getSsh().getHost().isEmpty()) {
            sendMessage(wsSession, "error", "Ambiente no configurado o sin SSH");
            closeQuietly(wsSession);
            return;
        }

        sendMessage(wsSession, "status", "connecting");

        try {
            sshSession = SSHService.createSession(env);
            shell = SSHService.openShell(sshSession, 24, 80);
            shellInput = shell.getOutputStream();

            sendMessage(wsSession, "status", "connected");

            // Read SSH output and forward to WebSocket
            InputStream shellOutput = shell.getInputStream();
            readerThread = new Thread(() -> {
                byte[] buf = new byte[4096];
                try {
                    int len;
                    while ((len = shellOutput.read(buf)) != -1) {
                        if (wsSession.isOpen()) {
                            sendMessage(wsSession, "output", new String(buf, 0, len));
                        } else {
                            break;
                        }
                    }
                } catch (IOException e) {
                    if (wsSession.isOpen()) {
                        sendMessage(wsSession, "status", "disconnected");
                    }
                }
            }, "ssh-reader-" + wsSession.getId());
            readerThread.setDaemon(true);
            readerThread.start();

        } catch (Exception e) {
            LOG.log(Level.WARNING, "SSH connection error", e);
            sendMessage(wsSession, "error", "Error SSH: " + e.getMessage());
            closeQuietly(wsSession);
        }
    }

    @OnMessage
    public void onMessage(String message, javax.websocket.Session wsSession) {
        try {
            JsonObject msg = GSON.fromJson(message, JsonObject.class);
            String type = msg.has("type") ? msg.get("type").getAsString() : "";

            if ("input".equals(type) && shellInput != null) {
                String data = msg.get("data").getAsString();
                shellInput.write(data.getBytes());
                shellInput.flush();
            } else if ("resize".equals(type) && shell != null) {
                int rows = msg.has("rows") ? msg.get("rows").getAsInt() : 24;
                int cols = msg.has("cols") ? msg.get("cols").getAsInt() : 80;
                shell.setPtySize(cols, rows, 0, 0);
            }
        } catch (Exception e) {
            // Try raw write
            try {
                if (shellInput != null) {
                    shellInput.write(message.getBytes());
                    shellInput.flush();
                }
            } catch (IOException ignored) {}
        }
    }

    @OnClose
    public void onClose(javax.websocket.Session wsSession) {
        cleanup();
    }

    @OnError
    public void onError(javax.websocket.Session wsSession, Throwable error) {
        LOG.log(Level.WARNING, "WebSocket error", error);
        cleanup();
    }

    private void cleanup() {
        if (readerThread != null) readerThread.interrupt();
        if (shell != null && shell.isConnected()) shell.disconnect();
        if (sshSession != null && sshSession.isConnected()) sshSession.disconnect();
    }

    private void sendMessage(javax.websocket.Session session, String type, String data) {
        if (session.isOpen()) {
            try {
                JsonObject msg = new JsonObject();
                msg.addProperty("type", type);
                msg.addProperty("data", data);
                session.getBasicRemote().sendText(GSON.toJson(msg));
            } catch (IOException e) {
                LOG.log(Level.FINE, "Error sending WS message", e);
            }
        }
    }

    private void closeQuietly(javax.websocket.Session session) {
        try { session.close(); } catch (IOException ignored) {}
    }
}
