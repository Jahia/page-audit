/**
 * Link health check. Internal links are verified with same-origin HEAD
 * requests using the editor's session; external links cannot be fetched
 * from the browser (CORS) and are only counted. Also detects hardcoded
 * absolute URLs to the current host (they break on environment changes).
 * Note: the audited render IS the default workspace, so /cms/render/default/
 * URLs are the normal shape of internal links here - not a defect.
 */

const MAX_CHECKED = 60;
const BATCH_SIZE = 6;

const SKIP_SCHEMES = /^(#|mailto:|tel:|javascript:)/i;

// Never fetch these: requesting a logout link kills the editor's session,
// and .do URLs are Jahia actions with side effects.
const SIDE_EFFECT = /logout|login|\.do($|\?)/i;

async function checkUrl(url) {
    const attempt = async method => {
        const response = await fetch(url, {
            method,
            credentials: 'same-origin',
            redirect: 'follow'
        });
        return response.status;
    };

    try {
        const status = await attempt('HEAD');
        // Some endpoints reject HEAD - retry with GET before flagging
        if (status === 405 || status === 501) {
            return await attempt('GET');
        }

        return status;
    } catch (e) {
        return 0; // Network error
    }
}

export async function runLinks(frame) {
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) {
        throw new Error('Preview frame is not accessible');
    }

    const origin = win.location.origin;
    const pageProtocol = win.location.protocol;

    const all = Array.from(doc.querySelectorAll('a[href]'))
        .map(a => ({
            href: a.getAttribute('href') || '',
            abs: a.href,
            text: (a.textContent || '').trim().slice(0, 80),
            targetBlank: a.getAttribute('target') === '_blank',
            rel: (a.getAttribute('rel') || '').toLowerCase()
        }))
        .filter(l => l.href && !SKIP_SCHEMES.test(l.href));

    const internal = all.filter(l => l.abs.startsWith(origin));
    const external = all.filter(l => !l.abs.startsWith(origin));

    // Absolute URL hardcoded to the current host: breaks on any other environment
    const hardcodedHost = internal.filter(l => /^https?:\/\//i.test(l.href));
    const blankNoopener = all.filter(l => l.targetBlank && !l.rel.includes('noopener')).length;
    const mixedContent = pageProtocol === 'https:' ?
        all.filter(l => l.abs.startsWith('http://')).length :
        0;

    // Dedupe internal URLs (without fragment) and verify them,
    // excluding URLs whose mere request has side effects
    const byUrl = new Map();
    let skippedSideEffect = 0;
    internal.forEach(l => {
        if (SIDE_EFFECT.test(l.abs)) {
            skippedSideEffect++;
            return;
        }

        const key = l.abs.split('#')[0];
        if (!byUrl.has(key)) {
            byUrl.set(key, l);
        }
    });
    const toCheck = Array.from(byUrl.entries()).slice(0, MAX_CHECKED);

    const broken = [];
    for (let i = 0; i < toCheck.length; i += BATCH_SIZE) {
        const batch = toCheck.slice(i, i + BATCH_SIZE);
        /* eslint-disable-next-line no-await-in-loop */
        const statuses = await Promise.all(batch.map(([url]) => checkUrl(url)));
        statuses.forEach((status, j) => {
            if (status >= 400 || status === 0) {
                const [url, link] = batch[j];
                broken.push({url, status, text: link.text, href: link.href});
            }
        });
    }

    const result = {
        total: all.length,
        internal: internal.length,
        external: external.length,
        checked: toCheck.length,
        skippedSideEffect,
        truncated: byUrl.size > MAX_CHECKED ? byUrl.size - MAX_CHECKED : 0,
        broken,
        hardcodedHost: hardcodedHost.length,
        blankNoopener,
        mixedContent
    };

    result.recommendations = buildLinksRecommendations(result);
    return result;
}

function buildLinksRecommendations(r) {
    const recs = [];
    const push = (key, severity, params) => recs.push({key, severity, params: params || {}});

    if (r.broken.length > 0) {
        push('brokenLinks', 'critical', {count: r.broken.length});
    }

    if (r.hardcodedHost > 0) {
        push('hardcodedUrls', 'moderate', {count: r.hardcodedHost});
    }

    if (r.mixedContent > 0) {
        push('mixedContent', 'serious', {count: r.mixedContent});
    }

    if (r.blankNoopener > 0) {
        push('blankNoopener', 'minor', {count: r.blankNoopener});
    }

    return recs;
}
