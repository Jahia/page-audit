/**
 * WCAG criteria that CANNOT be automated - they require human judgment.
 * Rendered as a guided manual checklist in the Accessibility tab so the
 * audit is a complete methodology (automated sweep + human review), not
 * just a scanner. Item keys resolve to a11y.checklist.items.<key> in the
 * locale bundles.
 */
export const MANUAL_CHECKLIST = [
    {
        level: 'A',
        items: ['keyboard', 'altQuality', 'media', 'focusOrder', 'linkPurpose']
    },
    {
        level: 'AA',
        items: ['zoom', 'reflow', 'focusVisible', 'formErrors', 'consistency']
    },
    {
        level: 'AAA',
        items: ['readingLevel', 'timing', 'targetSize', 'contextHelp']
    }
];
