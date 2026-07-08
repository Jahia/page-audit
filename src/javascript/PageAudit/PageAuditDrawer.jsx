import React, {useCallback, useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from 'react-i18next';
import {runAccessibility} from './analyzers/accessibility';
import {runWebVitals} from './analyzers/webVitals';
import {runReadability} from './analyzers/readability';
import {runSeo} from './analyzers/seo';
import {runLinks} from './analyzers/links';
import {AccessibilityTab} from './tabs/AccessibilityTab';
import {VitalsTab} from './tabs/VitalsTab';
import {ReadabilityTab} from './tabs/ReadabilityTab';
import {SeoTab} from './tabs/SeoTab';
import {LinksTab} from './tabs/LinksTab';
import styles from './PageAuditDrawer.module.css';

// Let client islands hydrate and layout settle before measuring
const SETTLE_MS = 2500;

export function PageAuditDrawer({isOpen, onClose, path, language}) {
    const {t} = useTranslation('page-audit');
    const [activeTab, setActiveTab] = useState('accessibility');
    const [status, setStatus] = useState('idle');
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [runId, setRunId] = useState(0);
    // The iframe is mounted only once the drawer slide-in transition is done:
    // loading it while the drawer is still translated off-screen makes Chrome
    // throttle rendering, and FCP/LCP paint entries never fire.
    const [frameVisible, setFrameVisible] = useState(false);
    const frameRef = useRef(null);
    const highlightedRef = useRef(null);

    const previewUrl = `/cms/render/default/${language}${path}.html?pageAuditRun=${runId}`;

    useEffect(() => {
        if (isOpen) {
            setStatus('loading');
            setResults(null);
            setError(null);
            highlightedRef.current = null;
            const timer = setTimeout(() => setFrameVisible(true), 400);
            return () => clearTimeout(timer);
        }

        setFrameVisible(false);
    }, [isOpen, runId]);

    const handleFrameLoad = useCallback(() => {
        setStatus('analyzing');
        setTimeout(async () => {
            const frame = frameRef.current;
            try {
                if (!frame || !frame.contentDocument) {
                    throw new Error('Preview frame unavailable');
                }

                // Vitals first: axe injection and link checks would otherwise
                // appear in the page's own resource statistics.
                const vitals = await runWebVitals(frame);
                const readability = runReadability(frame, language);
                const seo = runSeo(frame, language);
                const a11y = await runAccessibility(frame);
                const links = await runLinks(frame);
                setResults({a11y, vitals, readability, seo, links});
                setStatus('ready');
            } catch (e) {
                console.error('[page-audit] analysis failed', e);
                setError(e.message);
                setStatus('error');
            }
        }, SETTLE_MS);
    }, [language]);

    const highlight = useCallback(selector => {
        const doc = frameRef.current && frameRef.current.contentDocument;
        if (!doc) {
            return;
        }

        if (highlightedRef.current) {
            try {
                highlightedRef.current.style.outline = '';
                highlightedRef.current.style.outlineOffset = '';
            } catch (e) {
                // Element may be gone after re-run
            }
        }

        let el = null;
        try {
            el = doc.querySelector(selector);
        } catch (e) {
            return;
        }

        if (el) {
            el.scrollIntoView({behavior: 'smooth', block: 'center'});
            el.style.outline = '3px solid #e0182d';
            el.style.outlineOffset = '2px';
            highlightedRef.current = el;
        }
    }, []);

    const exportJson = useCallback(() => {
        if (!results) {
            return;
        }

        const payload = {path, language, url: previewUrl.split('?')[0], results};
        const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `page-audit-${path.split('/').filter(Boolean).pop() || 'page'}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }, [results, path, language, previewUrl]);

    // Badges all mean the same thing: number of issues to review in that tab.
    const tabs = [
        {key: 'accessibility', label: t('tabs.accessibility'), badge: results ? results.a11y.violations.length : null},
        {key: 'seo', label: t('tabs.seo'), badge: results ? results.seo.recommendations.length : null},
        {key: 'links', label: t('tabs.links'), badge: results ? results.links.recommendations.length : null},
        {key: 'vitals', label: t('tabs.vitals'), badge: results ? results.vitals.recommendations.length : null},
        {key: 'readability', label: t('tabs.readability'), badge: results ? results.readability.recommendations.length : null}
    ];

    return (
        <>
            <div
                aria-hidden="true"
                className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ''}`}
                onClick={onClose}
            />
            <aside
                aria-label={t('drawer.title')}
                className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}
            >
                <header className={styles.header}>
                    <div className={styles.headerText}>
                        <span className={styles.title}>{t('drawer.title')}</span>
                        <span className={styles.path} title={path}>{path}</span>
                    </div>
                    <div className={styles.headerActions}>
                        <button
                            type="button"
                            className={styles.headerButton}
                            disabled={status === 'loading' || status === 'analyzing'}
                            onClick={() => setRunId(id => id + 1)}
                        >
                            {t('drawer.rerun')}
                        </button>
                        <button
                            type="button"
                            className={styles.headerButton}
                            disabled={!results}
                            onClick={exportJson}
                        >
                            {t('drawer.export')}
                        </button>
                        <button
                            type="button"
                            aria-label={t('drawer.close')}
                            className={styles.closeButton}
                            onClick={onClose}
                        >
                            ×
                        </button>
                    </div>
                </header>

                <div className={styles.preview}>
                    {frameVisible && (
                        <iframe
                            key={runId}
                            ref={frameRef}
                            title={t('drawer.preview')}
                            src={previewUrl}
                            className={styles.frame}
                            onLoad={handleFrameLoad}
                        />
                    )}
                </div>

                <nav className={styles.tabs}>
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                            title={tab.badge === null ? undefined : t('tabs.badgeTooltip', {count: tab.badge})}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                            {tab.badge !== null && tab.badge !== undefined &&
                                <span className={styles.badge}>{tab.badge}</span>}
                        </button>
                    ))}
                </nav>

                <div className={styles.content}>
                    {(status === 'loading' || status === 'analyzing') && (
                        <div className={styles.status}>
                            <div className={styles.spinner}/>
                            {t(status === 'loading' ? 'drawer.loading' : 'drawer.analyzing')}
                        </div>
                    )}
                    {status === 'error' && (
                        <div className={styles.error}>{t('drawer.error')}: {error}</div>
                    )}
                    {status === 'ready' && results && (
                        <>
                            {activeTab === 'accessibility' &&
                                <AccessibilityTab result={results.a11y} onHighlight={highlight}/>}
                            {activeTab === 'seo' &&
                                <SeoTab result={results.seo}/>}
                            {activeTab === 'links' &&
                                <LinksTab result={results.links} onHighlight={highlight}/>}
                            {activeTab === 'vitals' &&
                                <VitalsTab result={results.vitals}/>}
                            {activeTab === 'readability' &&
                                <ReadabilityTab result={results.readability}/>}
                        </>
                    )}
                </div>
            </aside>
        </>
    );
}

PageAuditDrawer.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    path: PropTypes.string.isRequired,
    language: PropTypes.string.isRequired
};
