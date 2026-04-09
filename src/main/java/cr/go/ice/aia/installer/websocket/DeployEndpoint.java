package cr.go.ice.aia.installer.websocket;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import cr.go.ice.aia.installer.model.Environment;
import cr.go.ice.aia.installer.service.ConfigService;
import cr.go.ice.aia.installer.service.SSHService;

import javax.websocket.*;
import javax.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * WebSocket endpoint for ANT deployment with live-streamed output.
 * URL: /ws/deploy?token=JWT&envId=xxx
 */
@ServerEndpoint(value = "/ws/deploy", configurator = WsAuthConfigurator.class)
public class DeployEndpoint {

    private static final Logger LOG = Logger.getLogger(DeployEndpoint.class.getName());
    private static final Gson GSON = new Gson();

    private String envId;

    @OnOpen
    public void onOpen(javax.websocket.Session wsSession, EndpointConfig config) {
        Map<String, Object> props = config.getUserProperties();
        this.envId = (String) props.get("envId");
    }

    @OnMessage
    public void onMessage(String message, javax.websocket.Session wsSession) {
        try {
            JsonObject msg = GSON.fromJson(message, JsonObject.class);
            String type = msg.has("type") ? msg.get("type").getAsString() : "";

            if ("start".equals(type)) {
                String remoteExtractDir = msg.has("remoteExtractDir")
                        ? msg.get("remoteExtractDir").getAsString() : null;

                if (remoteExtractDir == null || remoteExtractDir.isEmpty()) {
                    sendMessage(wsSession, "error", "remoteExtractDir requerido");
                    return;
                }

                // Run deployment in a separate thread
                Thread deployThread = new Thread(() -> runDeployment(wsSession, remoteExtractDir),
                        "deploy-" + wsSession.getId());
                deployThread.setDaemon(true);
                deployThread.start();
            }
        } catch (Exception e) {
            sendMessage(wsSession, "error", "Mensaje inválido: " + e.getMessage());
        }
    }

    private void runDeployment(javax.websocket.Session wsSession, String remoteExtractDir) {
        Environment env = ConfigService.getInstance().resolveEnvironment(envId);
        if (env == null) {
            sendMessage(wsSession, "error", "Ambiente no configurado");
            return;
        }

        String antScript = env.getPaths().getAntScript();
        String cmd = String.format("sh \"%s\" \"%s\" 2>&1", antScript, remoteExtractDir);

        sendMessage(wsSession, "status", "running");
        sendMessage(wsSession, "output", "\r\n$ " + cmd + "\r\n");

        try {
            String fullOutput = SSHService.execCommandStreamed(
                    env, cmd,
                    chunk -> sendMessage(wsSession, "output", chunk),
                    600000
            );

            boolean success = fullOutput.contains("BUILD SUCCESSFUL");
            boolean failed = fullOutput.contains("BUILD FAILED");

            JsonObject doneData = new JsonObject();
            doneData.addProperty("success", success);
            doneData.addProperty("failed", failed && !success);
            doneData.addProperty("output", fullOutput);

            if (wsSession.isOpen()) {
                JsonObject doneMsg = new JsonObject();
                doneMsg.addProperty("type", "done");
                doneMsg.add("data", doneData);
                wsSession.getBasicRemote().sendText(GSON.toJson(doneMsg));
            }

        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Deployment error", e);
            sendMessage(wsSession, "error", e.getMessage());
        }

        closeQuietly(wsSession);
    }

    @OnClose
    public void onClose(javax.websocket.Session wsSession) {}

    @OnError
    public void onError(javax.websocket.Session wsSession, Throwable error) {
        LOG.log(Level.WARNING, "Deploy WebSocket error", error);
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
