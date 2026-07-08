# Page Quality Audit

Jahia jContent UI extension (OSGi/Maven, React 18, Webpack + Module Federation) that adds a **Page audit** action on pages in jContent and Page Builder. The action opens a right-side drawer that loads the page in a same-origin preview iframe and runs three analyses on the rendered DOM:

| Tab | What it does |
|---|---|
| **Accessibility** | axe-core against the full WCAG A / AA / AAA + best-practice rule set. Per-level scorecards, violations grouped by severity, element highlighting in the preview. |
| **Web Vitals** | Lab measurement via buffered `PerformanceObserver`: TTFB, FCP, LCP, CLS (INP reported as not measurable without interaction), plus diagnostics: page weight, request count, DOM size, image issues, largest resources. |
| **Readability** | Language-aware scoring: Flesch Reading Ease + Flesch-Kincaid grade (EN), Kandel-Moles adaptation (FR). Sentence/paragraph stats, heading structure checks. |

Results can be re-run and exported as JSON.

## Build and deploy

Requires Java 17 and Maven 3.6+.

```bash
mvn clean install
# then deploy target/page-audit-<version>.jar via the Jahia module manager, or:
curl -s --user root:root --form bundle=@target/page-audit-1.0.0-SNAPSHOT.jar --form start=true http://localhost:8080/modules/api/bundles
```

The module must be **enabled on the target site** (Administration > Modules) for the action to appear - the action guards with `requireModuleInstalledOnSite`.

## Architecture notes

- The audit runs entirely in the editor's browser against `/cms/render/default/{lang}{path}.html` (default workspace - you audit what you are editing, including unpublished changes).
- axe-core is injected into the iframe via `axe.source`; the preview iframe is visible (not `display:none`) so paint metrics (FCP/LCP) are real.
- No Java code in this phase. A future PageSpeed Insights proxy (field data for published pages) would follow the OSGi whiteboard servlet + `.cfg` config-service pattern.
- Automated WCAG checks cover a subset of criteria; the UI states this explicitly and never claims full compliance.

See [.agents/README.md](.agents/README.md) for the agent harness.
