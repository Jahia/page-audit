import axe from 'axe-core';

const TAG_SETS = {
    A: ['wcag2a', 'wcag21a'],
    AA: ['wcag2aa', 'wcag21aa', 'wcag22aa'],
    AAA: ['wcag2aaa']
};

const ALL_TAGS = [...TAG_SETS.A, ...TAG_SETS.AA, ...TAG_SETS.AAA, 'best-practice'];

const IMPACT_ORDER = {critical: 0, serious: 1, moderate: 2, minor: 3};

function levelOf(tags) {
    if (tags.some(t => TAG_SETS.AAA.includes(t))) {
        return 'AAA';
    }

    if (tags.some(t => TAG_SETS.AA.includes(t))) {
        return 'AA';
    }

    if (tags.some(t => TAG_SETS.A.includes(t))) {
        return 'A';
    }

    return 'BP';
}

function mapRule(rule) {
    return {
        id: rule.id,
        impact: rule.impact || 'minor',
        help: rule.help,
        helpUrl: rule.helpUrl,
        description: rule.description,
        level: levelOf(rule.tags),
        nodes: rule.nodes.slice(0, 25).map(n => ({
            target: Array.isArray(n.target) ? n.target.join(' ') : String(n.target),
            html: n.html,
            failureSummary: n.failureSummary
        })),
        totalNodes: rule.nodes.length
    };
}

/**
 * Injects axe-core into the (same-origin) preview iframe and runs the full
 * WCAG A / AA / AAA + best-practice rule set against its document.
 */
export async function runAccessibility(frame) {
    const win = frame.contentWindow;
    const doc = frame.contentDocument;

    if (!win || !doc) {
        throw new Error('Preview frame is not accessible');
    }

    if (!win.axe) {
        const script = doc.createElement('script');
        script.textContent = axe.source;
        doc.head.appendChild(script);
    }

    if (!win.axe) {
        throw new Error('Could not inject axe-core into the preview frame');
    }

    const raw = await win.axe.run(doc, {
        runOnly: {type: 'tag', values: ALL_TAGS},
        resultTypes: ['violations', 'passes', 'incomplete']
    });

    const violations = raw.violations.map(mapRule)
        .sort((a, b) => (IMPACT_ORDER[a.impact] || 4) - (IMPACT_ORDER[b.impact] || 4));
    const incomplete = raw.incomplete.map(mapRule);
    const passLevels = raw.passes.map(p => levelOf(p.tags));

    const summary = {};
    ['A', 'AA', 'AAA', 'BP'].forEach(level => {
        summary[level] = {
            violations: violations.filter(v => v.level === level).length,
            passes: passLevels.filter(l => l === level).length,
            incomplete: incomplete.filter(v => v.level === level).length
        };
    });

    return {
        summary,
        violations,
        incomplete,
        passCount: raw.passes.length,
        engine: `axe-core ${raw.testEngine ? raw.testEngine.version : ''}`.trim()
    };
}
