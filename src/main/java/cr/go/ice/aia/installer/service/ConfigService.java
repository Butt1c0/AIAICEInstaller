package cr.go.ice.aia.installer.service;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import cr.go.ice.aia.installer.model.AppConfig;
import cr.go.ice.aia.installer.model.Environment;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Manages persisted application configuration (environments, SSH settings, paths).
 * Config file is stored in the WebLogic domain directory by default.
 */
public class ConfigService {

    private static final Logger LOG = Logger.getLogger(ConfigService.class.getName());
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private static ConfigService instance;
    private Path configPath;
    private AppConfig config;

    private ConfigService() {}

    public static synchronized ConfigService getInstance() {
        if (instance == null) {
            instance = new ConfigService();
        }
        return instance;
    }

    public void init(String configFileName) {
        // Resolve config file: first try WL domain dir, fallback to user.dir
        String domainHome = System.getProperty("weblogic.home",
                System.getProperty("user.dir"));
        this.configPath = Paths.get(domainHome, configFileName);
        load();
    }

    public synchronized AppConfig getConfig() {
        if (config == null) load();
        return config;
    }

    public synchronized void save() {
        try {
            Files.createDirectories(configPath.getParent());
            try (Writer w = new OutputStreamWriter(
                    new FileOutputStream(configPath.toFile()), StandardCharsets.UTF_8)) {
                GSON.toJson(config, w);
            }
        } catch (IOException e) {
            LOG.log(Level.SEVERE, "Error saving config to " + configPath, e);
        }
    }

    public synchronized Environment addEnvironment(Environment env) {
        config.getEnvironments().add(env);
        if (config.getActiveEnvironment() == null) {
            config.setActiveEnvironment(env.getId());
        }
        save();
        return env;
    }

    public synchronized Environment updateEnvironment(String id, Environment updated) {
        for (int i = 0; i < config.getEnvironments().size(); i++) {
            Environment existing = config.getEnvironments().get(i);
            if (existing.getId().equals(id)) {
                updated.setId(id);
                // Preserve password if not sent
                if (updated.getSsh().getPassword() == null || updated.getSsh().getPassword().isEmpty()) {
                    updated.getSsh().setPassword(existing.getSsh().getPassword());
                }
                if (updated.getSsh().getPrivateKey() == null || updated.getSsh().getPrivateKey().isEmpty()) {
                    updated.getSsh().setPrivateKey(existing.getSsh().getPrivateKey());
                }
                config.getEnvironments().set(i, updated);
                save();
                return updated;
            }
        }
        return null;
    }

    public synchronized boolean deleteEnvironment(String id) {
        boolean removed = config.getEnvironments().removeIf(e -> e.getId().equals(id));
        if (removed) {
            if (id.equals(config.getActiveEnvironment())) {
                config.setActiveEnvironment(
                        config.getEnvironments().isEmpty() ? null : config.getEnvironments().get(0).getId());
            }
            save();
        }
        return removed;
    }

    public synchronized void setActiveEnvironment(String id) {
        config.setActiveEnvironment(id);
        save();
    }

    /**
     * Returns the environment by ID, or the active environment if id is null.
     */
    public Environment resolveEnvironment(String envId) {
        AppConfig c = getConfig();
        if (envId != null && !envId.isEmpty()) {
            return c.findById(envId);
        }
        return c.getActive();
    }

    private void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (Reader r = new InputStreamReader(
                    new FileInputStream(configPath.toFile()), StandardCharsets.UTF_8)) {
                config = GSON.fromJson(r, AppConfig.class);
                LOG.info("Config loaded from " + configPath);
            } catch (Exception e) {
                LOG.log(Level.WARNING, "Error loading config, starting fresh", e);
                config = new AppConfig();
            }
        } else {
            config = new AppConfig();
            LOG.info("No config file found at " + configPath + ", using defaults");
        }
    }
}
