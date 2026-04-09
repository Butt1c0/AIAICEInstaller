package cr.go.ice.aia.installer.rest;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import cr.go.ice.aia.installer.model.AppConfig;
import cr.go.ice.aia.installer.model.Environment;
import cr.go.ice.aia.installer.service.ConfigService;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.List;
import java.util.stream.Collectors;

@Path("/config")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ConfigResource {

    private static final Gson GSON = new GsonBuilder().create();
    private final ConfigService config = ConfigService.getInstance();

    @GET
    @Path("/environments")
    public Response listEnvironments() {
        AppConfig cfg = config.getConfig();
        List<Environment> masked = cfg.getEnvironments().stream()
                .map(ConfigResource::maskEnv).collect(Collectors.toList());
        JsonObject result = new JsonObject();
        result.add("environments", GSON.toJsonTree(masked));
        result.addProperty("activeEnvironment", cfg.getActiveEnvironment());
        return Response.ok(GSON.toJson(result)).build();
    }

    @POST
    @Path("/environments")
    public Response createEnvironment(String body) {
        Environment env = GSON.fromJson(body, Environment.class);
        if (env.getId() == null || env.getId().isEmpty()) {
            env = new Environment(); // generates UUID
            Environment parsed = GSON.fromJson(body, Environment.class);
            env.setName(parsed.getName());
            env.setWeblogicUrl(parsed.getWeblogicUrl());
            if (parsed.getSsh() != null) env.setSsh(parsed.getSsh());
            if (parsed.getPaths() != null) env.setPaths(parsed.getPaths());
        }
        config.addEnvironment(env);
        return Response.status(201).entity(GSON.toJson(maskEnv(env))).build();
    }

    @PUT
    @Path("/environments/{id}")
    public Response updateEnvironment(@PathParam("id") String id, String body) {
        Environment env = GSON.fromJson(body, Environment.class);
        Environment updated = config.updateEnvironment(id, env);
        if (updated == null) return errorResponse(404, "Ambiente no encontrado");
        return Response.ok(GSON.toJson(maskEnv(updated))).build();
    }

    @DELETE
    @Path("/environments/{id}")
    public Response deleteEnvironment(@PathParam("id") String id) {
        if (!config.deleteEnvironment(id)) return errorResponse(404, "Ambiente no encontrado");
        JsonObject result = new JsonObject();
        result.addProperty("ok", true);
        return Response.ok(GSON.toJson(result)).build();
    }

    @PUT
    @Path("/active-environment")
    public Response setActiveEnvironment(String body) {
        JsonObject req = GSON.fromJson(body, JsonObject.class);
        String id = req.has("id") ? req.get("id").getAsString() : null;
        if (id == null || config.getConfig().findById(id) == null) {
            return errorResponse(404, "Ambiente no encontrado");
        }
        config.setActiveEnvironment(id);
        JsonObject result = new JsonObject();
        result.addProperty("ok", true);
        return Response.ok(GSON.toJson(result)).build();
    }

    @GET
    @Path("/environments/{id}/full")
    public Response getFullEnvironment(@PathParam("id") String id) {
        Environment env = config.getConfig().findById(id);
        if (env == null) return errorResponse(404, "Ambiente no encontrado");
        return Response.ok(GSON.toJson(env)).build();
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private static Environment maskEnv(Environment env) {
        // Create a copy with masked sensitive fields
        Environment masked = new Environment();
        masked.setId(env.getId());
        masked.setName(env.getName());
        masked.setWeblogicUrl(env.getWeblogicUrl());
        masked.setPaths(env.getPaths());

        Environment.SshConfig ssh = new Environment.SshConfig();
        ssh.setHost(env.getSsh().getHost());
        ssh.setPort(env.getSsh().getPort());
        ssh.setUsername(env.getSsh().getUsername());
        ssh.setPassword(env.getSsh().getPassword() != null && !env.getSsh().getPassword().isEmpty()
                ? "••••••••" : "");
        ssh.setPrivateKey(env.getSsh().getPrivateKey() != null && !env.getSsh().getPrivateKey().isEmpty()
                ? "(configurado)" : "");
        masked.setSsh(ssh);

        return masked;
    }

    private Response errorResponse(int status, String message) {
        JsonObject err = new JsonObject();
        err.addProperty("error", message);
        return Response.status(status).entity(GSON.toJson(err)).build();
    }
}
