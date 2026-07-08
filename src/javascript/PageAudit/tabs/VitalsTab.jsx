import React from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from 'react-i18next';
import {bandOf} from '../analyzers/webVitals';
import styles from './Tabs.module.css';

function formatMs(value) {
    if (value === null || value === undefined) {
        return '-';
    }

    return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
}

function formatBytes(bytes) {
    if (bytes > 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${Math.round(bytes / 1024)} kB`;
}

const METRICS = ['lcp', 'fcp', 'cls', 'ttfb', 'inp'];

export function VitalsTab({result}) {
    const {t} = useTranslation('page-audit');
    const {metrics, diagnostics} = result;

    return (
        <div>
            <p className={styles.note}>{t('vitals.labNote')}</p>

            <div className={styles.cards}>
                {METRICS.map(key => {
                    const value = metrics[key];
                    const band = bandOf(key, value);
                    const display = key === 'cls' ?
                        (value === null ? '-' : value.toFixed(3)) :
                        formatMs(value);
                    return (
                        <div
                            key={key}
                            className={`${styles.card} ${band ? styles[`band_${band}`] : ''}`}
                        >
                            <span className={styles.cardTitle}>{t(`vitals.metrics.${key}`)}</span>
                            <span className={styles.cardValue}>
                                {key === 'inp' ? t('vitals.inpNa') : display}
                            </span>
                            {band && <span className={styles.cardHint}>{t(`vitals.bands.${band}`)}</span>}
                        </div>
                    );
                })}
            </div>

            <h4 className={styles.sectionTitle}>{t('vitals.diagnostics')}</h4>
            <ul className={styles.statList}>
                <li>{t('vitals.requests')}: <strong>{diagnostics.requests}</strong></li>
                <li>{t('vitals.weight')}: <strong>{formatBytes(diagnostics.totalBytes)}</strong></li>
                <li>{t('vitals.domNodes')}: <strong>{diagnostics.domNodes}</strong></li>
                <li>
                    {t('vitals.images')}: <strong>{diagnostics.images}</strong>
                    {diagnostics.missingDims > 0 &&
                        <span className={styles.warn}> · {t('vitals.missingDims', {count: diagnostics.missingDims})}</span>}
                    {diagnostics.oversized > 0 &&
                        <span className={styles.warn}> · {t('vitals.oversized', {count: diagnostics.oversized})}</span>}
                </li>
            </ul>

            {diagnostics.largest.length > 0 && (
                <>
                    <h4 className={styles.sectionTitle}>{t('vitals.largest')}</h4>
                    <ul className={styles.statList}>
                        {diagnostics.largest.map(r => (
                            <li key={r.url} title={r.url}>
                                <code>{r.name}</code> ({r.type}) - <strong>{formatBytes(r.bytes)}</strong>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}

VitalsTab.propTypes = {
    result: PropTypes.object.isRequired
};
