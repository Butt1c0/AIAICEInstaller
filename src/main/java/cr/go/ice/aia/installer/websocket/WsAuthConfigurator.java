package cr.go.ice.aia.installer.websocket;

import cr.go.ice.aia.installer.util.JwtUtil;
import io.jsonwebtoken.Claims;

import javax.websocket.HandshakeResponse;
import javax.websocket.server.HandshakeRequest;
import javax.websocket.server.ServerEndpointConfig;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * WebSocket handshake configurator that validates JWT token
 * from query parameters and passes envId to the endpoint.
 */
public class WsAuthConfigurator extends ServerEndpointConfig.Configurator {

    private static final Logger LOG = Logger.getLogger(WsAuthConfigurator.class.getName());

    @Override
    public void modifyHandshake(ServerEndpointConfig config,
                                HandshakeRequest request,
                                HandshakeResponse response) {
        Map<String, List<String>> params = request.getParameterMap();

        String token = getFirst(params, "token");
        String envId = getFirst(params, "envId");

        if (token == null || token.isEmpty()) {
            LOG.warning("WebSocket handshake rejected: no token");
            throw new RuntimeException("Authentication required");
        }

        try {
            Claims claims = JwtUtil.validateToken(token);
            String username = claims.getSubject();

            config.getUserProperties().put("username", username);
            config.getUserProperties().put("envId",
                    envId != null ? envId : claims.get("envId", String.class));

            LOG.fine("WebSocket authenticated: " + username);
        } catch (Exception e) {
            LOG.log(Level.WARNING, "WebSocket handshake rejected: invalid token", e);
            throw new RuntimeException("Invalid token");
        }
    }

    private static String getFirst(Map<String, List<String>> params, String key) {
        List<String> values = params.get(key);
        return (values != null && !values.isEmpty()) ? values.get(0) : null;
    }
}
