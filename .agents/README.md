# Page Quality Audit - Agent Harness

This module is a **Track 2 OSGi UI extension** (see AIStartupKit CLAUDE.md): Maven bundle, React 18, Webpack + Module Federation, `@jahia/ui-extender`. It was cloned from the `jahia-mcp-chat` skeleton.

## Invariants

- React **18** only (shared MF singleton with jcontent). Never import React 19 APIs.
- Build with `mvn clean install` (Java 17). Never run `yarn webpack --watch` from an agent.
- Webpack output goes to `src/main/resources/javascript/apps/` and is cleaned by `maven-clean-plugin`.
- Bundle symbolic name is `page-audit`; the action's `requireModuleInstalledOnSite: ['page-audit']` depends on it - do not rename one without the other.
- Translations are bundled JSON (`src/main/resources/javascript/locales/{en,fr}.json`) registered synchronously via `i18next.addResourceBundle` in `init.js`. Every new UI string needs both EN and FR.
- Chrome emits **no paint-timing (FCP) or LCP entries for iframe documents** - do not try to observe them. LCP is approximated from the largest image in the initial viewport (`lcpApprox` flag) and displayed with an "estimated" hint. CLS and navigation timing DO work in iframes.
- `axe.source` was **removed in axe-core 4.x**. axe is shipped as a module static resource (`axe.min.js`, copied by webpack) and injected into the iframe via `<script src>`, then run as `contentWindow.axe.run(...)` - never `axe.run` from the parent realm.
- Run `runWebVitals` **before** `runAccessibility` and keep the `SELF_INJECTED` filter: the injected axe script otherwise shows up in the page's own resource statistics.
- Resource sizes use `transferSize || encodedBodySize`; memory-cache hits can still report 0, so page weight is indicative only.
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
