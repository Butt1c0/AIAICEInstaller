package cr.go.ice.aia.installer.rest;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import cr.go.ice.aia.installer.service.DocumentService;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.net.URLEncoder;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

@Path("/documents")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DocumentResource {

    private static final Logger LOG = Logger.getLogger(DocumentResource.class.getName());
    private static final Gson GSON = new Gson();

    @POST
    @Path("/ga20002")
    public Response generateGA20002(String body) {
        try {
            JsonObject req = GSON.fromJson(body, JsonObject.class);

            String releaseName = getStr(req, "releaseName");
            String environment = getStr(req, "environment");
            if (releaseName == null || environment == null) {
                return errorResponse(400, "releaseName y environment son requeridos");
            }

            Map<String, String> data = new HashMap<>();
            data.put("installDate", getStr(req, "installDate",
                    new SimpleDateFormat("dd/MM/yyyy").format(new Date())));
            data.put("projectCode", getStr(req, "projectCode", ""));
            data.put("releaseName", releaseName);
            data.put("executedBy", getStr(req, "executedBy", ""));
            data.put("environment", environment);
            data.put("status", getStr(req, "status", "Exitoso"));
            data.put("comments", getStr(req, "comments", "N/A"));
            data.put("rfcNumber", getStr(req, "rfcNumber", ""));
            data.put("dependenciesOutput", getStr(req, "dependenciesOutput", ""));
            data.put("antOutput", getStr(req, "antOutput", ""));
            data.put("preConditionsOutput", getStr(req, "preConditionsOutput", ""));
            data.put("postConditionsOutput", getStr(req, "postConditionsOutput", ""));

            byte[] docBytes = DocumentService.generateEvidenceDoc(data);

            String dateStr = new SimpleDateFormat("yyyyMMdd").format(new Date());
            String safeRelease = releaseName.replaceAll("[^a-zA-Z0-9._-]", "_");
            String fileName = String.format("[GA-20-002] - %s - Evidencia instalación_%s_%s.docx",
                    safeRelease, dateStr, environment);

            return Response.ok(docBytes)
                    .type("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                    .header("Content-Disposition",
                            "attachment; filename*=UTF-8''" + URLEncoder.encode(fileName, "UTF-8"))
                    .build();

        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Error generating GA-20-002 document", e);
            return errorResponse(500, "Error generando documento: " + e.getMessage());
        }
    }

    private String getStr(JsonObject obj, String key) {
        return obj.has(key) && !obj.get(key).isJsonNull() ? obj.get(key).getAsString() : null;
    }

    private String getStr(JsonObject obj, String key, String defaultValue) {
        String val = getStr(obj, key);
        return val != null ? val : defaultValue;
    }

    private Response errorResponse(int status, String message) {
        JsonObject err = new JsonObject();
        err.addProperty("error", message);
        return Response.status(status).entity(GSON.toJson(err)).build();
    }
}
