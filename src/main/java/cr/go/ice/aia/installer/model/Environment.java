package cr.go.ice.aia.installer.model;

import java.util.UUID;

public class Environment {
    private String id;
    private String name;
    private String weblogicUrl;
    private SshConfig ssh;
    private Paths paths;

    public Environment() {
        this.id = UUID.randomUUID().toString();
        this.ssh = new SshConfig();
        this.paths = new Paths();
    }

    // Getters and setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getWeblogicUrl() { return weblogicUrl; }
    public void setWeblogicUrl(String weblogicUrl) { this.weblogicUrl = weblogicUrl; }
    public SshConfig getSsh() { return ssh; }
    public void setSsh(SshConfig ssh) { this.ssh = ssh; }
    public Paths getPaths() { return paths; }
    public void setPaths(Paths paths) { this.paths = paths; }

    public static class SshConfig {
        private String host = "";
        private int port = 22;
        private String username = "oracle";
        private String password = "";
        private String privateKey = "";

        public String getHost() { return host; }
        public void setHost(String host) { this.host = host; }
        public int getPort() { return port; }
        public void setPort(int port) { this.port = port; }
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getPrivateKey() { return privateKey; }
        public void setPrivateKey(String privateKey) { this.privateKey = privateKey; }
    }

    public static class Paths {
        private String releasesBase = "/SOA/Oracle/AIA/Pases";
        private String antScript = "/SOA/Oracle/AIA/BaseScript/ANTScript.sh";
        private String logsDir = "/SOA/Shared/admin/aserver/base_domain/soa/aia/logs";

        public String getReleasesBase() { return releasesBase; }
        public void setReleasesBase(String releasesBase) { this.releasesBase = releasesBase; }
        public String getAntScript() { return antScript; }
        public void setAntScript(String antScript) { this.antScript = antScript; }
        public String getLogsDir() { return logsDir; }
        public void setLogsDir(String logsDir) { this.logsDir = logsDir; }
    }
}
