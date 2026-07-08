# Page Quality Audit - Agent Harness

This module is a **Track 2 OSGi UI extension** (see AIStartupKit CLAUDE.md): Maven bundle, React 18, Webpack + Module Federation, `@jahia/ui-extender`. It was cloned from the `jahia-mcp-chat` skeleton.

## Invariants

- React **18** only (shared MF singleton with jcontent). Never import React 19 APIs.
- Build with `mvn clean install` (Java 17). Never run `yarn webpack --watch` from an agent.
- Webpack output goes to `src/main/resources/javascript/apps/` and is cleaned by `maven-clean-plugin`.
- Bundle symbolic name is `page-audit`; the action's `requireModuleInstalledOnSite: ['page-audit']` depends on it - do not rename one without the other.
- Translations are bundled JSON (`src/main/resources/javascript/locales/{en,fr}.json`) registered synchronously via `i18next.addResourceBundle` in `init.js`. Every new UI string needs both EN and FR.
- The preview iframe must stay **visible** (not `display:none`) or FCP/LCP paint entries never fire.
- axe-core is injected into the iframe with `axe.source` and run as `contentWindow.axe.run(...)` - never `axe.run` from the parent realm.
- All analyzers receive the iframe element and must throw (not silently return) when `contentDocument` is unavailable.

## Layout

```
src/javascript/
├── index.js                  # jahiaApp-init:50 callback
├── init.js                   # translations + action registration (contentActions + headerPrimaryActions)
└── PageAudit/
    ├── PageAuditAction.jsx   # useNodeChecks (jnt:page + module-on-site) → portal drawer
    ├── PageAuditDrawer.jsx   # iframe lifecycle, tabs, highlight, export
    ├── analyzers/            # accessibility (axe), webVitals (PerformanceObserver), readability
    └── tabs/                 # presentation components
```

## Relevant AIStartupKit skills

- `/jahia-osgi-ui-extension` - canonical patterns for this module type
- `/jahia-dev-debug` - build/deploy/runtime debugging
