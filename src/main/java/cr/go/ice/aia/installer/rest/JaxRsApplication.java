package cr.go.ice.aia.installer.rest;

import javax.ws.rs.ApplicationPath;
import javax.ws.rs.core.Application;

@ApplicationPath("/api")
public class JaxRsApplication extends Application {
    // JAX-RS automatically discovers @Path annotated classes
}
