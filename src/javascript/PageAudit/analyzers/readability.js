/**
 * Language-aware readability analysis of the preview frame's main content.
 * EN: Flesch Reading Ease + Flesch-Kincaid grade level.
 * FR: Kandel-Moles adaptation of Flesch (207 - 1.015 ASL - 73.6 ASW).
 */

const FR_VOWELS = /[aeiouyàâäéèêëîïôöùûüœ]+/g;
const EN_VOWELS = /[aeiouy]+/g;

const LONG_SENTENCE_WORDS = 25;
const READING_WPM = 200;

function countSyllables(word, lang) {
    const w = word.toLowerCase().replace(/[^a-zàâäçéèêëîïôöùûüœ]/g, '');
    if (w.length === 0) {
        return 0;
    }

    const groups = w.match(lang === 'fr' ? FR_VOWELS : EN_VOWELS) || [];
    let count = groups.length;

    // Final silent e ("word" endings): English silent e, French e muet
    if (count > 1 && (w.endsWith('e') || w.endsWith('es') || (lang === 'en' && w.endsWith('ed')))) {
        count--;
    }

    return Math.max(1, count);
}

function scoreBand(score) {
    if (score >= 90) {
        return 'veryEasy';
    }

    if (score >= 70) {
        return 'easy';
    }

    if (score >= 50) {
        return 'standard';
    }

    if (score >= 30) {
        return 'difficult';
    }

    return 'veryDifficult';
}

export function runReadability(frame, language) {
    const doc = frame.contentDocument;
    if (!doc || !doc.body) {
        throw new Error('Preview frame is not accessible');
    }

    const lang = (language || doc.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    const rootEl = doc.querySelector('main') || doc.body;

    const clone = rootEl.cloneNode(true);
    clone.querySelectorAll('script,style,noscript,svg,nav,header,footer,[aria-hidden="true"]')
        .forEach(node => node.remove());
    // Join text nodes with spaces - textContent merges adjacent block
    // elements into single "words", skewing word and sentence counts
    const parts = [];
    const walker = doc.createTreeWalker(clone, 4 /* NodeFilter.SHOW_TEXT */);
    let textNode = walker.nextNode();
    while (textNode) {
        const t = textNode.textContent.trim();
        if (t) {
            parts.push(t);
        }

        textNode = walker.nextNode();
    }

    const text = parts.join(' ').replace(/\s+/g, ' ').trim();

    const sentences = text.split(/[.!?…]+(?:\s|$)/)
        .map(s => s.trim())
        .filter(s => s.split(/\s+/).length > 1);
    const words = text.split(/\s+/)
        .map(w => w.replace(/[^A-Za-zÀ-ÖØ-öø-ÿœ0-9'’-]/g, ''))
        .filter(w => w.length > 0);

    if (words.length < 30) {
        return {lang, empty: true, words: words.length, recommendations: []};
    }

    const syllables = words.reduce((sum, w) => sum + countSyllables(w, lang), 0);
    const asl = words.length / Math.max(1, sentences.length);
    const asw = syllables / words.length;

    const rawScore = lang === 'fr' ?
        207 - (1.015 * asl) - (73.6 * asw) :
        206.835 - (1.015 * asl) - (84.6 * asw);
    const score = Math.round(Math.min(100, Math.max(0, rawScore)));

    const longSentences = sentences.filter(s => s.split(/\s+/).length > LONG_SENTENCE_WORDS).length;

    // Heading structure (whole page for h1, main content for hierarchy)
    const levels = Array.from(rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6'))
        .map(h => Number(h.tagName[1]));
    let headingSkips = 0;
    let prev = 0;
    levels.forEach(level => {
        if (prev > 0 && level > prev + 1) {
            headingSkips++;
        }

        prev = level;
    });

    const paragraphs = Array.from(rootEl.querySelectorAll('p'))
        .filter(p => (p.textContent || '').trim().length > 0);
    const paragraphWords = paragraphs.reduce(
        (sum, p) => sum + (p.textContent || '').trim().split(/\s+/).length, 0
    );

    const result = {
        lang,
        empty: false,
        formula: lang === 'fr' ? 'Kandel-Moles' : 'Flesch',
        score,
        band: scoreBand(score),
        gradeLevel: lang === 'fr' ? null : Math.round(((0.39 * asl) + (11.8 * asw) - 15.59) * 10) / 10,
        words: words.length,
        sentences: sentences.length,
        avgSentenceLength: Math.round(asl * 10) / 10,
        avgSyllablesPerWord: Math.round(asw * 100) / 100,
        longSentences,
        readingMinutes: Math.max(1, Math.round(words.length / READING_WPM)),
        h1Count: doc.querySelectorAll('h1').length,
        headingSkips,
        paragraphs: paragraphs.length,
        avgWordsPerParagraph: paragraphs.length > 0 ? Math.round(paragraphWords / paragraphs.length) : 0
    };

    result.recommendations = buildReadabilityRecommendations(result);
    return result;
}

/**
 * Actionable advice derived from the scores. Keys resolve to
 * readability.recs.<key>.title / .detail in the locale bundles.
 */
function buildReadabilityRecommendations(r) {
    const recs = [];
    const push = (key, severity, params) => recs.push({key, severity, params: params || {}});

    if (r.score < 30) {
        push('veryHardText', 'serious', {score: r.score});
    } else if (r.score < 50) {
        push('hardText', 'moderate', {score: r.score});
    }

    if (r.longSentences > 0) {
        push('longSentences', r.longSentences / r.sentences > 0.2 ? 'moderate' : 'minor',
            {count: r.longSentences});
    }

    if (r.avgWordsPerParagraph > 80) {
        push('longParagraphs', 'moderate', {count: r.avgWordsPerParagraph});
    }

    if (r.h1Count !== 1) {
        push('h1Count', 'serious', {count: r.h1Count});
    }

    if (r.headingSkips > 0) {
        push('headingSkips', 'moderate', {count: r.headingSkips});
    }

    if (r.words < 300) {
        push('thinContent', 'minor', {count: r.words});
    }

    return recs;
}
