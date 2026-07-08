# Page Quality Audit

Jahia jContent UI extension (OSGi/Maven, React 18, Webpack + Module Federation) that adds a **Page audit** action on pages in jContent and Page Builder. The action opens a right-side drawer that loads the page in a same-origin preview iframe and audits it across six tabs. Every tab leads with **actionable recommendations** (severity chip + what is wrong + how to fix it), and every tab badge means the same thing: the number of issues to review.

| Tab | What it does |
|---|---|
| **Accessibility** | axe-core against the full WCAG A / AA / AAA + best-practice rule set. Per-level scorecards, violations grouped by severity with element highlighting, engine version and rules-run transparency, the "needs human review" cases axe cannot decide, and a manual checklist for the WCAG criteria no tool can automate. |
| **SEO** | Title and meta-description length bands, `noindex`/`nofollow` detection, canonical URL, Open Graph / Twitter card completeness with a rendered **social sharing preview card**, JSON-LD presence and validity, `<html lang>` vs audited language, image alt coverage, generic anchor texts. |
| **Links** | Verifies every internal link with the editor's session (HEAD, batched) and lists broken ones with highlight-in-preview. Flags hardcoded absolute URLs to the current host, mixed content, and `target="_blank"` without `rel="noopener"`. Never fetches login/logout/`.do` URLs (side effects); external links are counted but honestly marked unverifiable from the browser. |
| **Jahia** | The checks no generic web tool can do, via jcontent's shared Apollo GraphQL client: unpublished content blocks on the page (visitors see an older version), content missing translations in active site languages, raw i18n keys visible in the DOM (`namespace:key.path`), and placeholder text (lorem ipsum / TODO). |
| **Web Vitals** | Lab measurement via buffered `PerformanceObserver` and navigation timing: TTFB, DOM ready, full load, CLS, LCP (estimated - Chrome emits no LCP/paint entries in iframes; INP requires interaction), plus diagnostics: page weight, request count, DOM size, image issues, largest resources. |
| **Readability** | Language-aware scoring: Flesch Reading Ease + Flesch-Kincaid grade (EN), Kandel-Moles adaptation (FR). Sentence/paragraph stats, heading structure checks. |

Results can be re-run and exported as JSON. All UI ships in English and French.

## Build and deploy

Requires Java 17 and Maven 3.6+.

```bash
mvn clean install
# then deploy target/page-audit-<version>.jar via the Jahia module manager, or:
curl -s --user root:root --form bundle=@target/page-audit-1.0.0-SNAPSHOT.jar --form start=true http://localhost:8080/modules/api/bundles
```

The module must be **enabled on the target site** (Administration > Modules) for the action to appear - the action guards with `requireModuleInstalledOnSite`. It shows on `jnt:page` and `jmix:mainResource` content.

## CI and dependency updates

- GitHub Actions builds every push and PR (Java 17 + Maven; the bundle jar is uploaded as an artifact).
- Dependabot keeps dependencies current - notably **axe-core**, so new WCAG rules land automatically (the audit runs by WCAG tag, not a hardcoded rule list). Guardrails: React stays on 18 (jcontent's Module Federation singleton), the Jahia parent POM is never bumped, and majors known to break the runtime or require Node 20+ are ignored with explanations in `.github/dependabot.yml`.
- CI proves the bundle compiles; it cannot prove the drawer works in jcontent. Validate runtime-affecting bumps locally (build, deploy, open the drawer) before merging - css-loader 7 was CI-green and runtime-broken.

## Architecture notes

- The audit runs entirely in the editor's browser against `/cms/render/default/{lang}{path}.html` (default workspace - you audit what you are editing, including unpublished changes). Internal links legitimately look like `/cms/render/default/...` in this context.
- axe-core ships as a module static resource (`javascript/apps/axe.min.js`) and is injected into the iframe via `<script src>` (`axe.source` was removed in axe-core 4.x).
- Editor/preview tooling (e.g. jExperience's persona preview panel) is stripped from the iframe before analysis so it never pollutes results (`analyzers/tooling.js`).
- The drawer refuses to audit a preview that returned HTTP 4xx/5xx (e.g. a page missing in the audited language) instead of silently scoring an error page.
- GraphQL goes through jcontent's shared Apollo client (`@apollo/client` consumed via Module Federation, never bundled).
- No Java code in this phase. A future PageSpeed Insights proxy (field data for published pages) would follow the OSGi whiteboard servlet + `.cfg` config-service pattern.
- Automated WCAG checks cover a subset of criteria; the UI states this explicitly and never claims full compliance - the manual checklist covers the rest.

See [.agents/README.md](.agents/README.md) for the agent harness and the full list of implementation traps.
