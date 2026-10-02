---
page-audit: minor
---

The Accessibility scorecards now show the share of automated rules that passed at each WCAG level, instead of a violation count where zero was the good result. A clean level reads "100% automated rules passed" in green rather than a bare "0".

The wording is deliberately not "compliant": automated checks cover only part of WCAG, so a 100% card is not a conformity claim. Rules the engine could not decide stay out of the ratio and are listed as "to verify", a level with nothing to test shows no score instead of a fake 100%, and when a level has violations the card still says how many and how many elements they affect. The French copy also drops "conformes" for the same reason.
