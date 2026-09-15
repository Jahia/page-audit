---
page-audit: patch
---

Held back dependency updates that would break the jContent host. The packages this bundle shares with jContent as Module Federation singletons (i18next, react-i18next, @jahia/data-helper, @jahia/ui-extender, @jahia/moonstone) now have their majors pinned, because Webpack elects the highest version among providers: a newer major shipped here would replace the host's copy for the whole back-office UI, and the build compiles either way so continuous integration cannot catch it. Also refreshed the build tooling (webpack 5.110.3, frontend-maven-plugin 2.0.2).
