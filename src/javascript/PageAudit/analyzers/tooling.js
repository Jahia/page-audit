/**
 * Elements injected into the preview render by editing/preview tooling -
 * NOT part of what visitors see, so they must never be audited. They are
 * removed from the iframe DOM before any analyzer runs, which cleans
 * accessibility, SEO, links, readability and content-health scans at once.
 *
 * Known sources:
 * - jExperience persona preview: an opener link with CLASS
 *   "tst-openPersonaPanel" (not an id) and an iframe #personas_panel,
 *   injected client-side by wem.js when the page renders in an
 *   authoring context. Verified on the mdl site.
 */
const TOOLING_SELECTORS = [
    '[id^="tst-"]',
    '[class*="tst-"]',
    '#personas_panel'
];

export function removeToolingElements(doc) {
    let removed = 0;
    TOOLING_SELECTORS.forEach(selector => {
        doc.querySelectorAll(selector).forEach(el => {
            el.remove();
            removed++;
        });
    });
    return removed;
}
