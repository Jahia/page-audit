import {gql} from '@apollo/client';

/**
 * Jahia content-health analysis - the checks no generic web tool can do.
 * Combines GraphQL (publication status and translation coverage of every
 * content node on the page, via jcontent's shared Apollo client) with DOM
 * scans of the preview frame (raw i18n keys, placeholder text).
 */

const PAGE_HEALTH = gql`
    query pageAuditHealth($path: String!, $language: String!) {
        jcr {
            nodeByPath(path: $path) {
                workspace
                uuid
                aggregatedPublicationInfo(language: $language) {
                    publicationStatus
                }
                site {
                    workspace
                    uuid
                    languages {
                        language
                        activeInEdit
                    }
                }
                descendants(
                    typesFilter: {types: ["jnt:content"]}
                    recursionTypesFilter: {multi: NONE, types: ["jnt:page"]}
                    limit: 400
                ) {
                    nodes {
                        workspace
                        uuid
                        name
                        path
                        primaryNodeType {
                            name
                        }
                        aggregatedPublicationInfo(language: $language) {
                            publicationStatus
                        }
                        translationLanguages
                    }
                }
            }
        }
    }
`;

const BAD_STATUSES = ['MODIFIED', 'NOT_PUBLISHED', 'UNPUBLISHED', 'MARKED_FOR_DELETION', 'CONFLICT'];

// namespace:key.path.segments - schemes and URLs never match (letter start,
// at least one dotted segment, no slashes)
const RAW_KEY = /\b[a-z][a-zA-Z0-9_-]{1,30}:[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+\b/g;
const SCHEMES = /^(https?|mailto|tel|urn|data|javascript|file|ftp):/i;

const PLACEHOLDER = /lorem ipsum|\bTODO\b|\bFIXME\b|\bXXX\b|à compléter|to be completed/i;

const MAX_SAMPLES = 10;

function scanTextNodes(doc) {
    const rawKeys = [];
    const placeholders = [];
    const walker = doc.createTreeWalker(doc.body, 4 /* NodeFilter.SHOW_TEXT */);

    let node = walker.nextNode();
    while (node) {
        const parentTag = node.parentElement ? node.parentElement.tagName : '';
        if (!['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(parentTag)) {
            const text = node.textContent || '';

            const matches = text.match(RAW_KEY) || [];
            matches.forEach(m => {
                if (!SCHEMES.test(m)) {
                    rawKeys.push({key: m, text: text.trim().slice(0, 100)});
                }
            });

            const ph = text.match(PLACEHOLDER);
            if (ph) {
                placeholders.push({match: ph[0], text: text.trim().slice(0, 100)});
            }
        }

        node = walker.nextNode();
    }

    return {rawKeys, placeholders};
}

export async function runJahiaHealth(frame, {client, path, language}) {
    const doc = frame.contentDocument;
    if (!doc || !doc.body) {
        throw new Error('Preview frame is not accessible');
    }

    const {rawKeys, placeholders} = scanTextNodes(doc);

    let pageStatus = null;
    let activeLanguages = [];
    let unpublished = [];
    let untranslated = [];
    let scanned = 0;
    let graphqlUnavailable = false;

    try {
        if (!client) {
            throw new Error('Apollo client not available');
        }

        const {data} = await client.query({
            query: PAGE_HEALTH,
            variables: {path, language},
            fetchPolicy: 'no-cache'
        });

        const page = data && data.jcr && data.jcr.nodeByPath;
        if (page) {
            pageStatus = page.aggregatedPublicationInfo.publicationStatus;
            activeLanguages = (page.site.languages || [])
                .filter(l => l.activeInEdit)
                .map(l => l.language);

            const nodes = page.descendants.nodes || [];
            scanned = nodes.length;

            unpublished = nodes
                .filter(n => BAD_STATUSES.includes(n.aggregatedPublicationInfo.publicationStatus))
                .map(n => ({
                    path: n.path.replace(path, '') || '/',
                    type: n.primaryNodeType.name,
                    status: n.aggregatedPublicationInfo.publicationStatus
                }));

            // Only nodes that have SOME translations are i18n content; nodes
            // with none simply carry no translatable properties.
            untranslated = nodes
                .filter(n => (n.translationLanguages || []).length > 0)
                .map(n => ({
                    path: n.path.replace(path, '') || '/',
                    type: n.primaryNodeType.name,
                    missing: activeLanguages.filter(l => !n.translationLanguages.includes(l))
                }))
                .filter(n => n.missing.length > 0);
        }
    } catch (e) {
        console.warn('[page-audit] Jahia health GraphQL query failed', e);
        graphqlUnavailable = true;
    }

    const result = {
        pageStatus,
        activeLanguages,
        scanned,
        graphqlUnavailable,
        unpublished,
        untranslated,
        rawKeys: {count: rawKeys.length, samples: rawKeys.slice(0, MAX_SAMPLES)},
        placeholders: {count: placeholders.length, samples: placeholders.slice(0, MAX_SAMPLES)}
    };

    result.recommendations = buildHealthRecommendations(result);
    return result;
}

function buildHealthRecommendations(r) {
    const recs = [];
    const push = (key, severity, params) => recs.push({key, severity, params: params || {}});

    if (r.rawKeys.count > 0) {
        push('rawI18nKeys', 'critical', {count: r.rawKeys.count});
    }

    const pageUnpublished = r.pageStatus && BAD_STATUSES.includes(r.pageStatus);
    if (r.unpublished.length > 0 || pageUnpublished) {
        push('unpublishedChanges', 'serious', {count: r.unpublished.length + (pageUnpublished ? 1 : 0)});
    }

    if (r.untranslated.length > 0) {
        const languages = Array.from(new Set(r.untranslated.flatMap(n => n.missing))).join(', ');
        push('missingTranslations', 'serious', {count: r.untranslated.length, languages});
    }

    if (r.placeholders.count > 0) {
        push('placeholderText', 'serious', {count: r.placeholders.count});
    }

    if (r.graphqlUnavailable) {
        push('graphqlUnavailable', 'minor');
    }

    return recs;
}
