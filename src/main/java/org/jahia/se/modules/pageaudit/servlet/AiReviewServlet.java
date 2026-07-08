package org.jahia.se.modules.pageaudit.servlet;

import org.jahia.se.modules.pageaudit.config.PageAuditConfigService;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.usermanager.JahiaUser;
import org.json.JSONArray;
import org.json.JSONObject;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.Servlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

/**
 * Server-side AI review endpoint for the Page Quality Audit drawer.
 *
 * GET  /modules/page-audit/ai-review  -> {enabled, provider, model} (never the key)
 * POST /modules/page-audit/ai-review  -> runs the AI review and returns
 *      {provider, model, summary, recommendations: [{severity, category, title, detail, wording}]}
 *
 * The prompt is built server-side from a constrained payload (page text +
 * audit digest), so this endpoint cannot be abused as a general-purpose LLM
 * proxy. The API key is read from the OSGi configuration and never sent to
 * the browser. Inspired by Jahia/ai-content-sentinel (structured JSON-only
 * output) and jahia-mcp-chat (provider proxying).
 */
@Component(
        service = {HttpServlet.class, Servlet.class},
        property = {"alias=/page-audit/ai-review", "allow-api-token=true"},
        immediate = true)
public class AiReviewServlet extends HttpServlet {

    private static final Logger logger = LoggerFactory.getLogger(AiReviewServlet.class);

    private static final String ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
    private static final String OPENAI_URL = "https://api.openai.com/v1/chat/completions";
    private static final String DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

    private static final int MAX_TEXT_CHARS = 15000;
    private static final int MAX_DIGEST_LINES = 60;
    private static final int MAX_RECOMMENDATIONS = 20;

    private static final String SYSTEM_PROMPT =
            "You are a senior web quality consultant reviewing a CMS page before publication. "
            + "You receive the page text, its metadata, and a digest of automated audit findings "
            + "(accessibility, SEO, links, performance, readability, publication state). "
            + "Give recommendations a content editor can act on, preferring fixes that need no development work. "
            + "Do not repeat raw audit findings verbatim: prioritize them, connect them, and add what automated "
            + "tools cannot see. Actively check these dimensions the automated audit cannot cover:\n"
            + "- proofreading: typos, grammar, punctuation, capitalization mistakes (quote the exact wording)\n"
            + "- factuality: outdated or contradictory content - past dates presented as upcoming, stale years, "
            + "claims that contradict other parts of the page\n"
            + "- consistency: terminology drift (same product/name spelled differently), inconsistent date/number "
            + "formats, inconsistent heading capitalization\n"
            + "- conversion: missing or weak calls to action, vague button labels, no clear next step for the visitor\n"
            + "- localization: fragments in the wrong language for the page, machine-translation artifacts, "
            + "untranslated visible strings\n"
            + "- legal: unsubstantiated superlative claims, missing legal mentions, risky wording\n"
            + "Do not invent issues.\n\n"
            + "Reply ONLY with a valid JSON object. No markdown, no code fences, no comments, no trailing commas.\n"
            + "JSON structure:\n"
            + "{\n"
            + "  \"summary\": \"2-3 sentence overall assessment\",\n"
            + "  \"recommendations\": [\n"
            + "    {\n"
            + "      \"severity\": \"critical\" | \"serious\" | \"moderate\" | \"minor\",\n"
            + "      \"category\": \"content\" | \"seo\" | \"accessibility\" | \"performance\" | \"ux\" | "
            + "\"proofreading\" | \"factuality\" | \"consistency\" | \"conversion\" | \"localization\" | \"legal\",\n"
            + "      \"title\": \"short actionable title\",\n"
            + "      \"detail\": \"1-3 sentences: why it matters and how to fix it\",\n"
            + "      \"wording\": \"exact text quoted from the page when the issue concerns specific wording, else empty string\"\n"
            + "    }\n"
            + "  ]\n"
            + "}\n"
            + "Maximum 15 recommendations, most important first. "
            + "You MUST write every user-facing string (summary, title, detail) in the REPORT LANGUAGE stated in the "
            + "input - regardless of the language of the page text. Only the \"wording\" field keeps the page's own "
            + "language, since it quotes the page verbatim.";

    @Reference
    private PageAuditConfigService configService;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        JSONObject status = new JSONObject();
        status.put("enabled", configService.isAiEnabled());
        status.put("provider", configService.getProvider());
        status.put("model", configService.getModel());
        writeJson(res, HttpServletResponse.SC_OK, status);
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        if (isGuest()) {
            res.sendError(HttpServletResponse.SC_FORBIDDEN, "Authentication required");
            return;
        }

        if (!configService.isAiEnabled()) {
            writeError(res, HttpServletResponse.SC_SERVICE_UNAVAILABLE, "AI review is not configured");
            return;
        }

        JSONObject payload;
        try {
            payload = new JSONObject(req.getReader().lines().collect(Collectors.joining("\n")));
        } catch (Exception e) {
            writeError(res, HttpServletResponse.SC_BAD_REQUEST, "Invalid JSON payload");
            return;
        }

        String userContent = buildUserContent(payload);
        String provider = configService.getProvider();
        String model = configService.getModel();

        try {
            JSONObject providerResult = callProvider(provider, model, userContent);
            JSONObject review = parseReview(providerResult.getString("text"));
            review.put("provider", provider);
            review.put("model", model);
            if (providerResult.optBoolean("truncated", false)) {
                review.put("truncated", true);
                logger.warn("AI review answer truncated by AI_MAX_TOKENS ({}); complete recommendations were salvaged",
                        configService.getMaxTokens());
            }

            long inputTokens = providerResult.optLong("inputTokens", -1);
            long outputTokens = providerResult.optLong("outputTokens", -1);
            if (inputTokens >= 0 && outputTokens >= 0) {
                JSONObject usage = new JSONObject();
                usage.put("inputTokens", inputTokens);
                usage.put("outputTokens", outputTokens);
                // Rates are configured per million tokens (AI_COST_*_PER_MTOKENS)
                double cost = (inputTokens / 1_000_000.0) * configService.getCostInputPerMTokens()
                        + (outputTokens / 1_000_000.0) * configService.getCostOutputPerMTokens();
                usage.put("cost", Math.round(cost * 10_000.0) / 10_000.0);
                usage.put("currency", "USD");
                review.put("usage", usage);
            }

            writeJson(res, HttpServletResponse.SC_OK, review);
        } catch (Exception e) {
            logger.error("AI review failed", e);
            writeError(res, HttpServletResponse.SC_BAD_GATEWAY, "AI review failed: " + e.getMessage());
        }
    }

    private String buildUserContent(JSONObject payload) {
        StringBuilder sb = new StringBuilder();
        String pageLanguage = payload.optString("language", "en");
        String uiLanguage = payload.optString("uiLanguage", pageLanguage);
        sb.append("REPORT LANGUAGE: ").append(languageName(uiLanguage)).append('\n');
        sb.append("PAGE LANGUAGE: ").append(pageLanguage).append('\n');
        sb.append("PAGE PATH: ").append(payload.optString("path", "")).append('\n');
        sb.append("TITLE: ").append(payload.optString("title", "")).append('\n');
        sb.append("META DESCRIPTION: ").append(payload.optString("description", "")).append("\n\n");

        JSONArray findings = payload.optJSONArray("findings");
        if (findings != null && findings.length() > 0) {
            sb.append("AUTOMATED AUDIT DIGEST:\n");
            int lines = Math.min(findings.length(), MAX_DIGEST_LINES);
            for (int i = 0; i < lines; i++) {
                sb.append("- ").append(findings.optString(i, "")).append('\n');
            }

            sb.append('\n');
        }

        String text = payload.optString("text", "");
        if (text.length() > MAX_TEXT_CHARS) {
            text = text.substring(0, MAX_TEXT_CHARS) + "\n[... text truncated ...]";
        }

        sb.append("PAGE TEXT:\n").append(text);
        return sb.toString();
    }

    /** Resolves an ISO code to an explicit language name - models follow "write in French" far more reliably than "write in fr". */
    private String languageName(String isoCode) {
        String code = isoCode == null ? "en" : isoCode.toLowerCase();
        if (code.startsWith("fr")) {
            return "French";
        }

        if (code.startsWith("de")) {
            return "German";
        }

        if (code.startsWith("es")) {
            return "Spanish";
        }

        if (code.startsWith("it")) {
            return "Italian";
        }

        if (code.startsWith("pt")) {
            return "Portuguese";
        }

        if (code.startsWith("nl")) {
            return "Dutch";
        }

        if (code.startsWith("en")) {
            return "English";
        }

        return isoCode;
    }

    /** Returns {text, inputTokens, outputTokens} extracted from the provider envelope. */
    private JSONObject callProvider(String provider, String model, String userContent) throws IOException {
        String systemPrompt = SYSTEM_PROMPT;
        String appendix = configService.getPromptAppendix();
        if (!appendix.isBlank()) {
            systemPrompt += "\n\nAdditional site-specific instructions:\n" + appendix;
        }

        JSONObject body = new JSONObject();
        body.put("model", model);
        body.put("max_tokens", configService.getMaxTokens());

        String targetUrl;
        if ("openai".equalsIgnoreCase(provider) || "deepseek".equalsIgnoreCase(provider)) {
            targetUrl = "openai".equalsIgnoreCase(provider) ? OPENAI_URL : DEEPSEEK_URL;
            JSONArray messages = new JSONArray();
            messages.put(new JSONObject().put("role", "system").put("content", systemPrompt));
            messages.put(new JSONObject().put("role", "user").put("content", userContent));
            body.put("messages", messages);
        } else {
            targetUrl = ANTHROPIC_URL;
            body.put("system", systemPrompt);
            JSONArray messages = new JSONArray();
            messages.put(new JSONObject().put("role", "user").put("content", userContent));
            body.put("messages", messages);
        }

        HttpURLConnection conn = (HttpURLConnection) new URL(targetUrl).openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setConnectTimeout(10_000);
        conn.setReadTimeout(120_000);
        conn.setRequestProperty("Content-Type", "application/json");
        if ("anthropic".equalsIgnoreCase(provider)) {
            conn.setRequestProperty("x-api-key", configService.getApiKey());
            conn.setRequestProperty("anthropic-version", "2023-06-01");
        } else {
            conn.setRequestProperty("Authorization", "Bearer " + configService.getApiKey());
        }

        try (OutputStream out = conn.getOutputStream()) {
            out.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }

        int status = conn.getResponseCode();
        InputStream stream = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
        String response = stream == null ? "" : new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        conn.disconnect();

        if (status >= 400) {
            logger.warn("AI provider {} returned {}: {}", provider, status, response);
            throw new IOException("provider returned HTTP " + status);
        }

        JSONObject envelope = new JSONObject(response);
        JSONObject result = new JSONObject();
        JSONObject usage = envelope.optJSONObject("usage");
        if ("anthropic".equalsIgnoreCase(provider)) {
            result.put("text", envelope.getJSONArray("content").getJSONObject(0).getString("text"));
            result.put("truncated", "max_tokens".equals(envelope.optString("stop_reason")));
            if (usage != null) {
                result.put("inputTokens", usage.optLong("input_tokens", -1));
                result.put("outputTokens", usage.optLong("output_tokens", -1));
            }
        } else {
            JSONObject choice = envelope.getJSONArray("choices").getJSONObject(0);
            result.put("text", choice.getJSONObject("message").getString("content"));
            result.put("truncated", "length".equals(choice.optString("finish_reason")));
            if (usage != null) {
                result.put("inputTokens", usage.optLong("prompt_tokens", -1));
                result.put("outputTokens", usage.optLong("completion_tokens", -1));
            }
        }

        return result;
    }

    /**
     * Parses the model answer defensively (code fences, leading prose) and
     * re-serializes only whitelisted fields, so a malformed or malicious
     * answer can never inject unexpected structure into the client.
     */
    private JSONObject parseReview(String rawAnswer) {
        String cleaned = rawAnswer.trim();
        int start = cleaned.indexOf('{');
        if (start < 0) {
            throw new IllegalStateException("model did not return JSON");
        }

        JSONObject parsed = parseLenient(cleaned.substring(start));

        JSONObject safe = new JSONObject();
        safe.put("summary", parsed.optString("summary", ""));
        JSONArray safeRecs = new JSONArray();
        JSONArray recs = parsed.optJSONArray("recommendations");
        if (recs != null) {
            for (int i = 0; i < Math.min(recs.length(), MAX_RECOMMENDATIONS); i++) {
                JSONObject r = recs.optJSONObject(i);
                if (r == null || r.optString("title", "").isBlank()) {
                    continue;
                }

                JSONObject safeRec = new JSONObject();
                safeRec.put("severity", normalize(r.optString("severity", "moderate"),
                        new String[]{"critical", "serious", "moderate", "minor"}, "moderate"));
                safeRec.put("category", normalize(r.optString("category", "content"),
                        new String[]{"content", "seo", "accessibility", "performance", "ux",
                                "proofreading", "factuality", "consistency", "conversion",
                                "localization", "legal"}, "content"));
                safeRec.put("title", r.optString("title", ""));
                safeRec.put("detail", r.optString("detail", ""));
                safeRec.put("wording", r.optString("wording", ""));
                safeRecs.put(safeRec);
            }
        }

        safe.put("recommendations", safeRecs);
        return safe;
    }

    /**
     * Parses the model JSON, salvaging answers truncated by the max_tokens
     * limit: cut back to the last complete recommendation object and close
     * the array and root object. Complete recommendations are recovered
     * instead of failing the whole review.
     */
    private JSONObject parseLenient(String raw) {
        int end = raw.lastIndexOf('}');
        if (end > 0) {
            try {
                return new JSONObject(raw.substring(0, end + 1));
            } catch (Exception e) {
                // Fall through to truncation salvage
            }
        }

        int idx = raw.lastIndexOf("},");
        while (idx > 0) {
            try {
                return new JSONObject(raw.substring(0, idx + 1) + "]}");
            } catch (Exception e) {
                idx = raw.lastIndexOf("},", idx - 1);
            }
        }

        throw new IllegalStateException("model returned malformed JSON");
    }

    private String normalize(String value, String[] allowed, String fallback) {
        for (String a : allowed) {
            if (a.equalsIgnoreCase(value)) {
                return a;
            }
        }

        return fallback;
    }

    private boolean isGuest() {
        JahiaUser user = JCRSessionFactory.getInstance().getCurrentUser();
        return user == null || "guest".equals(user.getUsername());
    }

    private void writeJson(HttpServletResponse res, int status, JSONObject json) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write(json.toString());
    }

    private void writeError(HttpServletResponse res, int status, String message) throws IOException {
        writeJson(res, status, new JSONObject().put("error", message));
    }
}
