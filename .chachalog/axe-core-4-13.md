---
page-audit: minor
---

Upgraded the accessibility engine to axe-core 4.13. The Accessibility tab picks up the new rule set automatically, because the audit runs by WCAG tag rather than a hardcoded rule list. Editors will notice that `sectionheader` and `sectionfooter` roles are recognised, deprecated ARIA attributes are now reported as "needs review" instead of ignored, whitespace `alt` on presentational images is accepted, and several colour-contrast false positives caused by stacking contexts are gone. A page can therefore show a different violation count than it did on 4.12 without its markup having changed.
