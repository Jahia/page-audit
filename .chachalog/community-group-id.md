---
page-audit: patch
---

Moved the module to the `org.jahia.community.modules` groupId. The bundle name, the Java package and the OSGi configuration file name are unchanged, so AI provider settings and per-site activation survive the move.

Upgrading an instance that already runs an older release is **not** a drop-in install: Jahia identifies a module by its Id, and refuses to parse a bundle whose Id is already registered under a different groupId, leaving it stuck in `STARTING` with its resources unavailable. Uninstall every installed version of Page Quality Audit first, then install the new jar. The module defines no content types, so a full uninstall does not touch site content.
