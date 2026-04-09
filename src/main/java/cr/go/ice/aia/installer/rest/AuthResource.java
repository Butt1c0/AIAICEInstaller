package cr.go.ice.aia.installer.rest;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import cr.go.ice.aia.installer.model.Environment;
import cr.go.ice.aia.installer.service.ConfigService;
import cr.go.ice.aia.installer.util.JwtUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.logging.Level;
import java.util.logging.Logger;

@Path("/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {

    private static final Logger LOG = Logger.getLogger(AuthResource.class.getName());
    private static final Gson GSON = new Gson();

    /**
     * Authenticates using WebLogic Security Realm via programmatic container login.
     */
    @POST
    @Path("/login")
    public Response login(String body, @Context HttpServletRequest request) {
        JsonObject req = GSON.fromJson(body, JsonObject.class);
        String username = req.has("username") ? req.get("username").getAsString() : null;
        String password = req.has("password") ? req.get("password").getAsString() : null;

        if (username == null || password == null || username.isEmpty() || password.isEmpty()) {
            return errorResponse(400, "Usuario y contraseña requeridos");
        }

        ConfigService config = ConfigService.getInstance();
        Environment activeEnv = config.getConfig().getActive();
        String envName = activeEnv != null ? activeEnv.getName() : "Sin configurar";

        try {
            // Programmatic login against WebLogic security realm (Servlet 3.0+)
            request.login(username, password);

            // Check if user is in admin role
            if (!request.isUserInRole("admin") && !request.isUserInRole("Administrators")) {
                request.logout();
                return errorResponse(403, "Usuario sin permisos de administrador");
            }

            String envId = activeEnv != null ? activeEnv.getId() : "";
            String token = JwtUtil.generateToken(username, envId);

            JsonObject result = new JsonObject();
            result.addProperty("token", token);
            result.addProperty("username", username);
            result.addProperty("environment", envName);
            return Response.ok(GSON.toJson(result)).build();

        } catch (ServletException e) {
            LOG.log(Level.WARNING, "Login failed for " + username, e);
            return errorResponse(401, "Credenciales inválidas o usuario sin permisos de administrador");
        }
    }

    @POST
    @Path("/logout")
    public Response logout(@Context HttpServletRequest request) {
        try {
            request.logout();
        } catch (ServletException e) {
            // Ignore
        }
        JsonObject result = new JsonObject();
        result.addProperty("ok", true);
        return Response.ok(GSON.toJson(result)).build();
    }

    @GET
    @Path("/health")
    public Response health() {
        JsonObject result = new JsonObject();
        result.addProperty("ok", true);
        result.addProperty("version", "1.0.0");
        return Response.ok(GSON.toJson(result)).build();
    }

    private Response errorResponse(int status, String message) {
        JsonObject err = new JsonObject();
        err.addProperty("error", message);
        return Response.status(status).entity(GSON.toJson(err)).build();
    }
}
