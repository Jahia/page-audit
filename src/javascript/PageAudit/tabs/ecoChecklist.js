/**
 * RGESN criteria that cannot be judged from a single rendered page - hosting,
 * governance, backend, algorithms. Surfaced as a guided manual checklist so
 * the tab is honest about what automation covers. Keys resolve to
 * eco.checklist.items.<key> in the locale bundles.
 */
export const ECO_CHECKLIST = [
    {
        family: 'strategy',
        items: ['envTarget', 'reviewMissing']
    },
    {
        family: 'hosting',
        items: ['greenHost', 'caching']
    },
    {
        family: 'backend',
        items: ['apiEfficiency', 'pagination']
    },
    {
        family: 'ux',
        items: ['featureNeed', 'noDarkPattern']
    }
];
