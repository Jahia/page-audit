/**
 * RGESN (Référentiel Général d'Écoconception de Services Numériques, 2024)
 * page-level checks. RGESN assesses a whole service against ~78 criteria, most
 * of which are organizational (hosting, governance, backend). This analyzer
 * covers only the subset measurable from a single rendered page - the Frontend
 * and Contents families - and is explicit that it does NOT produce an RGESN
 * conformity score. The rest is surfaced as a manual checklist (ecoChecklist).
 *
 * Reuses the Web Vitals resource data (page weight, request count, DOM size,
 * image issues) and adds a few DOM/resource probes (lazy-loading, fonts,
 * autoplay media, modern image formats, third-party origins).
 */

// Google/RGESN-aligned budgets. Page weight in bytes; the rest are counts.
const WEIGHT_GOOD = 1_000_000;
const WEIGHT_POOR = 2_500_000;
const REQUESTS_GOOD = 40;
const REQUESTS_POOR = 70;
const DOM_GOOD = 1000;
const DOM_POOR = 1500;
const FONT_FILES_MAX = 2;
const THIRD_PARTY_MAX = 5;

const LEGACY_IMAGE = /\.(jpe?g|png|gif|bmp|tiff?)($|\?)/i;
const MODERN_IMAGE = /\.(webp|avif)($|\?)/i;
const FONT_FILE = /\.(woff2?|ttf|otf|eot)($|\?)/i;

function sizeOf(entry) {
    return entry.transferSize || entry.encodedBodySize || 0;
}

/**
 * @param frame   the preview iframe element
 * @param vitals  the Web Vitals analyzer result (diagnostics reused here)
 */
export function runEcodesign(frame, vitals) {
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    if (!win || !doc) {
        throw new Error('Preview frame is not accessible');
    }

    const origin = win.location.origin;
    const resources = win.performance.getEntriesByType('resource');

    // --- resource-derived signals -----------------------------------------
    const fontFiles = resources.filter(r => FONT_FILE.test(r.name));
    const legacyFonts = fontFiles.filter(r => !/\.woff2($|\?)/i.test(r.name)).length;

    const imageResources = resources.filter(r =>
        r.initiatorType === 'img' || LEGACY_IMAGE.test(r.name) || MODERN_IMAGE.test(r.name));
    const legacyImages = imageResources.filter(r =>
        LEGACY_IMAGE.test(r.name) && sizeOf(r) > 30_000).length;

    const thirdParty = new Set();
    resources.forEach(r => {
        try {
            const o = new win.URL(r.name).origin;
            if (o !== origin) {
                thirdParty.add(o);
            }
        } catch (e) {
            // ignore malformed
        }
    });

    // --- DOM signals -------------------------------------------------------
    const images = Array.from(doc.images || []);
    const vh = win.innerHeight || 800;
    const belowFold = images.filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.top >= vh;
    });
    const belowFoldEager = belowFold.filter(img =>
        (img.getAttribute('loading') || '').toLowerCase() !== 'lazy').length;

    const autoplay = doc.querySelectorAll('video[autoplay], audio[autoplay]').length;

    const d = vitals && vitals.diagnostics ? vitals.diagnostics : {};
    const totalBytes = d.totalBytes || 0;
    const requests = d.requests || resources.length + 1;
    const domNodes = d.domNodes || doc.querySelectorAll('*').length;
    const oversized = d.oversized || 0;
    const missingDims = d.missingDims || 0;

    const band = (value, good, poor) =>
        value <= good ? 'good' : (value <= poor ? 'ni' : 'poor');

    // --- criteria ----------------------------------------------------------
    const criteria = [
        {
            key: 'pageWeight', family: 'frontend',
            ok: totalBytes <= WEIGHT_GOOD,
            band: band(totalBytes, WEIGHT_GOOD, WEIGHT_POOR),
            value: `${(totalBytes / 1024 / 1024).toFixed(2)} MB`
        },
        {
            key: 'requests', family: 'frontend',
            ok: requests <= REQUESTS_GOOD,
            band: band(requests, REQUESTS_GOOD, REQUESTS_POOR),
            value: `${requests}`
        },
        {
            key: 'domSize', family: 'frontend',
            ok: domNodes <= DOM_GOOD,
            band: band(domNodes, DOM_GOOD, DOM_POOR),
            value: `${domNodes}`
        },
        {
            key: 'lazyLoading', family: 'frontend',
            ok: belowFoldEager === 0,
            value: belowFoldEager > 0 ? `${belowFoldEager}/${belowFold.length}` : String(belowFold.length)
        },
        {
            key: 'webFonts', family: 'frontend',
            ok: fontFiles.length <= FONT_FILES_MAX && legacyFonts === 0,
            value: `${fontFiles.length}${legacyFonts > 0 ? ` (${legacyFonts} legacy)` : ''}`
        },
        {
            key: 'autoplay', family: 'ux',
            ok: autoplay === 0,
            value: `${autoplay}`
        },
        {
            key: 'imageFormats', family: 'contents',
            ok: legacyImages === 0,
            value: `${legacyImages}`
        },
        {
            key: 'oversizedImages', family: 'contents',
            ok: oversized === 0,
            value: `${oversized}`
        },
        {
            key: 'imageDimensions', family: 'contents',
            ok: missingDims === 0,
            value: `${missingDims}`
        },
        {
            key: 'thirdParty', family: 'architecture',
            ok: thirdParty.size <= THIRD_PARTY_MAX,
            value: `${thirdParty.size}`
        }
    ];

    const passed = criteria.filter(c => c.ok).length;

    const result = {
        criteria,
        passed,
        total: criteria.length,
        stats: {
            totalBytes,
            requests,
            domNodes,
            fontFiles: fontFiles.length,
            thirdParty: thirdParty.size,
            legacyImages
        }
    };

    result.recommendations = buildEcoRecommendations({criteria, belowFoldEager, legacyFonts,
        autoplay, legacyImages, oversized, missingDims, thirdParty: thirdParty.size,
        fontFiles: fontFiles.length, totalBytes, requests, domNodes});
    return result;
}

function buildEcoRecommendations(x) {
    const recs = [];
    const push = (key, severity, params) => recs.push({key, severity, params: params || {}});

    if (x.totalBytes > WEIGHT_POOR) {
        push('pageWeight', 'serious', {size: `${(x.totalBytes / 1024 / 1024).toFixed(1)} MB`});
    } else if (x.totalBytes > WEIGHT_GOOD) {
        push('pageWeight', 'moderate', {size: `${(x.totalBytes / 1024 / 1024).toFixed(1)} MB`});
    }

    if (x.requests > REQUESTS_POOR) {
        push('requests', 'serious', {count: x.requests});
    } else if (x.requests > REQUESTS_GOOD) {
        push('requests', 'moderate', {count: x.requests});
    }

    if (x.domNodes > DOM_POOR) {
        push('domSize', 'moderate', {count: x.domNodes});
    }

    if (x.belowFoldEager > 0) {
        push('lazyLoading', 'moderate', {count: x.belowFoldEager});
    }

    if (x.legacyImages > 0) {
        push('imageFormats', 'moderate', {count: x.legacyImages});
    }

    if (x.oversized > 0) {
        push('oversizedImages', 'moderate', {count: x.oversized});
    }

    if (x.missingDims > 0) {
        push('imageDimensions', 'minor', {count: x.missingDims});
    }

    if (x.fontFiles > FONT_FILES_MAX || x.legacyFonts > 0) {
        push('webFonts', 'minor', {count: x.fontFiles, legacy: x.legacyFonts});
    }

    if (x.autoplay > 0) {
        push('autoplay', 'moderate', {count: x.autoplay});
    }

    if (x.thirdParty > THIRD_PARTY_MAX) {
        push('thirdParty', 'moderate', {count: x.thirdParty});
    }

    return recs;
}
