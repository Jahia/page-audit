/**
 * Lab measurement of web vitals inside the (same-origin) preview iframe.
 * Uses buffered PerformanceObserver entries, so it can be run after the
 * page has finished loading. Chrome does not emit paint-timing (FCP) or
 * LCP entries for iframe documents, so LCP falls back to an approximation
 * from the largest image in the initial viewport (flagged lcpApprox).
 * INP is not measurable without real user interaction and is reported
 * as null.
 */

const OBSERVE_WINDOW_MS = 700;

// Resources injected by the audit itself (axe-core script) must not
// pollute the page's own stats.
const SELF_INJECTED = /\/modules\/page-audit\//;

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

// transferSize is 0 for resources served from the HTTP cache;
// fall back to the encoded body size so page weight stays meaningful.
function sizeOf(entry) {
    return entry.transferSize || entry.encodedBodySize || 0;
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

    const [lcpEntries, shiftEntries] = await Promise.all([
        observeBuffered(win, 'largest-contentful-paint'),
        observeBuffered(win, 'layout-shift')
    ]);

    const lcpEntry = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1] : null;
    const cls = shiftEntries
        .filter(e => !e.hadRecentInput)
        .reduce((sum, e) => sum + e.value, 0);

    const resources = win.performance.getEntriesByType('resource')
        .filter(r => !SELF_INJECTED.test(r.name));

    let lcp = lcpEntry ? (lcpEntry.renderTime || lcpEntry.loadTime) : null;
    let lcpApprox = false;
    if (lcp === null) {
        const vw = win.innerWidth;
        const vh = win.innerHeight;
        let best = null;
        Array.from(doc.images || []).forEach(img => {
            const rect = img.getBoundingClientRect();
            if (rect.width * rect.height === 0 || rect.top >= vh || rect.bottom <= 0 || rect.left >= vw) {
                return;
            }

            const area = Math.min(rect.width, vw) * Math.min(rect.height, vh);
            if (!best || area > best.area) {
                best = {area, src: img.currentSrc || img.src};
            }
        });

        const bestResource = best && resources.find(r => r.name === best.src);
        if (bestResource) {
            lcp = bestResource.responseEnd;
            lcpApprox = true;
        } else if (nav && nav.domContentLoadedEventEnd) {
            lcp = nav.domContentLoadedEventEnd;
            lcpApprox = true;
        }
    }
    const totalBytes = resources.reduce((sum, r) => sum + sizeOf(r), 0) +
        (nav ? sizeOf(nav) : 0);

    const byType = {};
    resources.forEach(r => {
        const type = r.initiatorType || 'other';
        byType[type] = (byType[type] || 0) + 1;
    });

    const largest = [...resources]
        .sort((a, b) => sizeOf(b) - sizeOf(a))
        .slice(0, 5)
        .map(r => ({
            name: shortName(r.name),
            url: r.name,
            bytes: sizeOf(r),
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
            dcl: nav && nav.domContentLoadedEventEnd ? nav.domContentLoadedEventEnd : null,
            load: nav && nav.loadEventEnd ? nav.loadEventEnd : null,
            lcp,
            lcpApprox,
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
