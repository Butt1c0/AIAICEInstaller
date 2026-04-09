package cr.go.ice.aia.installer.rest;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import cr.go.ice.aia.installer.model.Environment;
import cr.go.ice.aia.installer.service.ConfigService;
import cr.go.ice.aia.installer.service.SSHService;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.Part;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.*;
import java.nio.file.Files;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.logging.Level;
import java.util.logging.Logger;

@Path("/deploy")
@Produces(MediaType.APPLICATION_JSON)
public class DeployResource {

    private static final Logger LOG = Logger.getLogger(DeployResource.class.getName());
    private static final Gson GSON = new Gson();
    private final ConfigService config = ConfigService.getInstance();

    /**
     * Uploads a release ZIP to the remote server via SFTP.
     * Expects multipart form data: release (file), environmentId, paseName
     */
    @POST
    @Path("/upload")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response uploadRelease(@Context HttpServletRequest request) {
        File tempFile = null;
        try {
            Part filePart = request.getPart("release");
            String envId = getPartValue(request, "environmentId");
            String paseName = getPartValue(request, "paseName");

            if (filePart == null) return errorResponse(400, "No se recibió archivo");

            String originalName = getFileName(filePart);
            if (originalName == null || !originalName.toLowerCase().endsWith(".zip")) {
                return errorResponse(400, "Solo se permiten archivos .zip");
            }

            Environment env = config.resolveEnvironment(envId);
            if (env == null) return errorResponse(400, "Ambiente no configurado");

            if (paseName == null || paseName.isEmpty()) {
                paseName = "Pase" + new SimpleDateFormat("yyyyMMdd").format(new Date());
            }

            String releaseName = originalName.replace(".zip", "");
            String remotePaseDir = env.getPaths().getReleasesBase() + "/" + paseName;
            String remoteExtractDir = remotePaseDir + "/" + releaseName;

            // Save to temp file
            tempFile = Files.createTempFile("aiaice-", ".zip").toFile();
            try (InputStream is = filePart.getInputStream();
                 OutputStream os = new FileOutputStream(tempFile)) {
                byte[] buf = new byte[8192];
                int len;
                while ((len = is.read(buf)) != -1) os.write(buf, 0, len);
            }

            // Upload via SFTP
            SSHService.uploadFile(env, tempFile, remotePaseDir, originalName);

            // Extract ZIP on server
            String extractCmd = String.format(
                    "mkdir -p \"%s\" && cd \"%s\" && unzip -o \"%s\" -d \"%s\" 2>&1",
                    remoteExtractDir, remotePaseDir, originalName, releaseName);
            String extractLog = SSHService.execCommand(env, extractCmd, 120000);

            JsonObject result = new JsonObject();
            result.addProperty("ok", true);
            result.addProperty("releaseName", releaseName);
            result.addProperty("remoteZipPath", remotePaseDir + "/" + originalName);
            result.addProperty("remoteExtractDir", remoteExtractDir);
            result.addProperty("remotePaseDir", remotePaseDir);
            result.addProperty("extractLog", extractLog);
            return Response.ok(GSON.toJson(result)).build();

        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Upload error", e);
            return errorResponse(500, e.getMessage());
        } finally {
            if (tempFile != null) tempFile.delete();
        }
    }

    /**
     * Checks dependencies on the remote server.
     */
    @POST
    @Path("/check-dependencies")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response checkDependencies(String body) {
        try {
            JsonObject req = GSON.fromJson(body, JsonObject.class);
            String envId = req.has("environmentId") ? req.get("environmentId").getAsString() : null;
            String searchPath = req.has("searchPath") ? req.get("searchPath").getAsString() : null;

            JsonArray deps = req.getAsJsonArray("dependencies");
            if (deps == null || deps.size() == 0) {
                return errorResponse(400, "Lista de dependencias requerida");
            }

            Environment env = config.resolveEnvironment(envId);
            if (env == null) return errorResponse(400, "Ambiente no configurado");

            if (searchPath == null || searchPath.isEmpty()) {
                searchPath = "/SOA/Oracle/AIA";
            }

            JsonArray results = new JsonArray();
            for (int i = 0; i < deps.size(); i++) {
                String dep = deps.get(i).getAsString().trim();
                if (dep.isEmpty()) continue;

                String cmd = String.format("find %s -name \"*%s*\" 2>/dev/null | head -20", searchPath, dep);
                String output = SSHService.execCommand(env, cmd, 30000);
                boolean found = output.trim().length() > 0;

                JsonObject r = new JsonObject();
                r.addProperty("dependency", dep);
                r.addProperty("found", found);
                r.addProperty("output", output.trim());
                results.add(r);
            }

            JsonObject result = new JsonObject();
            result.add("results", results);
            return Response.ok(GSON.toJson(result)).build();

        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Dependency check error", e);
            return errorResponse(500, e.getMessage());
        }
    }

    /**
     * Executes the ANT script (non-streaming REST version, for fallback).
     * The WebSocket endpoint is preferred for live streaming.
     */
    @POST
    @Path("/run-ant")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response runAnt(String body) {
        try {
            JsonObject req = GSON.fromJson(body, JsonObject.class);
            String envId = req.has("environmentId") ? req.get("environmentId").getAsString() : null;
            String remoteExtractDir = req.has("remoteExtractDir") ? req.get("remoteExtractDir").getAsString() : null;

            if (remoteExtractDir == null || remoteExtractDir.isEmpty()) {
                return errorResponse(400, "remoteExtractDir requerido");
            }

            Environment env = config.resolveEnvironment(envId);
            if (env == null) return errorResponse(400, "Ambiente no configurado");

            String cmd = String.format("sh \"%s\" \"%s\" 2>&1", env.getPaths().getAntScript(), remoteExtractDir);
            String output = SSHService.execCommand(env, cmd, 600000);

            boolean success = output.contains("BUILD SUCCESSFUL");

            JsonObject result = new JsonObject();
            result.addProperty("ok", true);
            result.addProperty("success", success);
            result.addProperty("failed", !success);
            result.addProperty("output", output);
            return Response.ok(GSON.toJson(result)).build();

        } catch (Exception e) {
            LOG.log(Level.SEVERE, "ANT execution error", e);
            return errorResponse(500, e.getMessage());
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private String getPartValue(HttpServletRequest request, String name) throws Exception {
        Part part = request.getPart(name);
        if (part == null) return null;
        try (InputStream is = part.getInputStream()) {
            byte[] buf = new byte[(int) part.getSize()];
            is.read(buf);
            return new String(buf).trim();
        }
    }

    private String getFileName(Part part) {
        String contentDisposition = part.getHeader("content-disposition");
        if (contentDisposition != null) {
            for (String token : contentDisposition.split(";")) {
                token = token.trim();
                if (token.startsWith("filename=")) {
                    return token.substring(10, token.length() - 1);
                }
            }
        }
        return part.getSubmittedFileName(); // Servlet 3.1
    }

    private Response errorResponse(int status, String message) {
        JsonObject err = new JsonObject();
        err.addProperty("error", message);
        return Response.status(status).entity(GSON.toJson(err)).build();
    }
}
