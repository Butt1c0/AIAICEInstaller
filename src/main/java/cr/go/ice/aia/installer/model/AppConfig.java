package cr.go.ice.aia.installer.model;

import java.util.ArrayList;
import java.util.List;

public class AppConfig {
    private List<Environment> environments = new ArrayList<>();
    private String activeEnvironment;

    public List<Environment> getEnvironments() { return environments; }
    public void setEnvironments(List<Environment> environments) { this.environments = environments; }
    public String getActiveEnvironment() { return activeEnvironment; }
    public void setActiveEnvironment(String activeEnvironment) { this.activeEnvironment = activeEnvironment; }

    public Environment findById(String id) {
        if (id == null) return null;
        return environments.stream().filter(e -> id.equals(e.getId())).findFirst().orElse(null);
    }

    public Environment getActive() {
        return findById(activeEnvironment);
    }
}
