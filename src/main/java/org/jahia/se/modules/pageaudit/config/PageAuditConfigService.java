package org.jahia.se.modules.pageaudit.config;

import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Modified;

import java.util.Map;

/**
 * OSGi-managed configuration for the Page Quality Audit AI review.
 * Edit digital-factory-data/karaf/etc/org.jahia.se.modules.pageaudit.cfg at
 * runtime - changes are picked up immediately via @Modified without
 * redeployment. The API key never leaves the server: the front-end only
 * learns whether AI review is enabled, and with which provider/model.
 */
@Component(
        service = PageAuditConfigService.class,
        configurationPid = "org.jahia.se.modules.pageaudit",
        immediate = true)
public class PageAuditConfigService {

    private volatile Snapshot config = Snapshot.defaults();

    @Activate
    @Modified
    protected void activate(Map<String, Object> properties) {
        this.config = Snapshot.from(properties);
    }

    public String getProvider() {
        return config.provider;
    }

    public String getModel() {
        return config.model;
    }

    public String getApiKey() {
        return config.apiKey;
    }

    public int getMaxTokens() {
        return config.maxTokens;
    }

    public String getPromptAppendix() {
        return config.promptAppendix;
    }

    public boolean isAiEnabled() {
        return !config.apiKey.isBlank();
    }

    // Immutable snapshot - a single volatile read gives a fully-consistent config view
    private static final class Snapshot {

        final String provider;
        final String model;
        final String apiKey;
        final int maxTokens;
        final String promptAppendix;

        private Snapshot(String provider, String model, String apiKey, int maxTokens, String promptAppendix) {
            this.provider = provider;
            this.model = model;
            this.apiKey = apiKey;
            this.maxTokens = maxTokens;
            this.promptAppendix = promptAppendix;
        }

        static Snapshot defaults() {
            return new Snapshot("anthropic", "claude-sonnet-5", "", 2048, "");
        }

        static Snapshot from(Map<String, Object> p) {
            return new Snapshot(
                    str(p, "AI_PROVIDER", "anthropic"),
                    str(p, "AI_MODEL", "claude-sonnet-5"),
                    str(p, "AI_API_KEY", ""),
                    intVal(p, "AI_MAX_TOKENS", 2048),
                    str(p, "AI_PROMPT_APPENDIX", "")
            );
        }

        private static String str(Map<String, Object> m, String key, String def) {
            Object v = m.get(key);
            if (v instanceof String) {
                String s = ((String) v).trim();
                return !s.isBlank() ? s : def;
            }

            return def;
        }

        private static int intVal(Map<String, Object> m, String key, int def) {
            try {
                return Integer.parseInt(String.valueOf(m.get(key)));
            } catch (Exception e) {
                return def;
            }
        }
    }
}
