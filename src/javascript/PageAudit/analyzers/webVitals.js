/**
 * Lab measurement of web vitals inside the (same-origin) preview iframe.
 * Uses buffered PerformanceObserver entries, so it can be run after the
 * page has finished loading. INP is not measurable without real user
 * interaction and is reported as null.
 */

const OBSERVE_WINDOW_MS = 700;

function observeBuffered(win, type) {
    return new Promise(resolve => {
        const entries = [];
        let observer;

        try {
            observer = new win.PerformanceObserver(list => entries.push(...list.getEntries()));
            observer.observe({type, buffered: true});
        } catch (e) {
            resolve(entries);
            return;
        }

        setTimeout(() => {
            try {
                observer.disconnect();
            } catch (e) {
                // Frame may have been detached meanwhile
            }

            resolve(entries);
        }, OBSERVE_WINDOW_MS);
    });
}

function shortName(url) {
    try {
        const clean = url.split('?')[0].split('#')[0];
        const last = clean.split('/').filter(Boolean).pop();
        return last || clean;
    } catch (e) {
        return url;
    }
}

export async function runWebVitals(frame) {
    const win = frame.contentWindow;
    const doc = frame.contentDocument;

    if (!win || !doc) {
        throw new Error('Preview frame is not accessible');
    }

    const nav = win.performance.getEntriesByType('navigation')[0];
    const paints = win.performance.getEntriesByType('paint');
    const fcpEntry = paints.find(p => p.name === 'first-contentful-paint');

    const [lcpEntries, shiftEntries] = await Promise.all([
        observeBuffered(win, 'largest-contentful-paint'),
        observeBuffered(win, 'layout-shift')
    ]);

    const lcpEntry = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1] : null;
    const cls = shiftEntries
        .filter(e => !e.hadRecentInput)
        .reduce((sum, e) => sum + e.value, 0);

    const resources = win.performance.getEntriesByType('resource');
    const totalBytes = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) +
        (nav ? (nav.transferSize || 0) : 0);

    const byType = {};
    resources.forEach(r => {
        const type = r.initiatorType || 'other';
        byType[type] = (byType[type] || 0) + 1;
    });

    const largest = [...resources]
        .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
        .slice(0, 5)
        .map(r => ({
            name: shortName(r.name),
            url: r.name,
            bytes: r.transferSize || 0,
            type: r.initiatorType || 'other'
        }));

    const images = Array.from(doc.images || []);
    const missingDims = images.filter(img => !img.getAttribute('width') || !img.getAttribute('height')).length;
    const oversized = images.filter(img =>
        img.naturalWidth > 0 && img.clientWidth > 0 && img.naturalWidth > img.clientWidth * 2
    ).length;

    return {
        metrics: {
            ttfb: nav ? nav.responseStart : null,
            fcp: fcpEntry ? fcpEntry.startTime : null,
            lcp: lcpEntry ? (lcpEntry.renderTime || lcpEntry.loadTime) : null,
            cls,
            inp: null
        },
        diagnostics: {
            requests: resources.length + 1,
            totalBytes,
            byType,
            largest,
            domNodes: doc.querySelectorAll('*').length,
            images: images.length,
            missingDims,
            oversized
        }
    };
}

/** Google thresholds: [good upper bound, needs-improvement upper bound] */
export const THRESHOLDS = {
    lcp: [2500, 4000],
    fcp: [1800, 3000],
    cls: [0.1, 0.25],
    ttfb: [800, 1800]
};

export function bandOf(metric, value) {
    const t = THRESHOLDS[metric];
    if (!t || value === null || value === undefined) {
        return null;
    }

    if (value <= t[0]) {
        return 'good';
    }

    return value <= t[1] ? 'ni' : 'poor';
}
