---
page-audit: patch
---

Refreshed the build tooling: webpack 5.111.1 and @jahia/moonstone 2.21.0. Moonstone is a declared dependency but is never imported by the drawer nor shared with jContent, so the update has no effect on the back-office.
