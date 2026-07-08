import React from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from 'react-i18next';
import {Recommendations} from './Recommendations';
import styles from './Tabs.module.css';

const selectorFor = href =>
    `a[href="${href.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;

export function LinksTab({result, onHighlight}) {
    const {t} = useTranslation('page-audit');

    return (
        <div>
            <Recommendations items={result.recommendations} ns="links"/>

            <h4 className={styles.sectionTitle}>{t('links.summary')}</h4>
            <ul className={styles.statList}>
                <li>{t('links.total')}: <strong>{result.total}</strong></li>
                <li>
                    {t('links.internal')}: <strong>{result.internal}</strong>
                    {' '}· {t('links.checked', {count: result.checked})}
                    {result.skippedSideEffect > 0 && <span> · {t('links.skipped', {count: result.skippedSideEffect})}</span>}
                    {result.truncated > 0 && <span className={styles.warn}> · {t('links.truncated', {count: result.truncated})}</span>}
                </li>
                <li>{t('links.external')}: <strong>{result.external}</strong> · <span className={styles.note}>{t('links.externalNote')}</span></li>
            </ul>

            {result.broken.length > 0 && (
                <>
                    <h4 className={styles.sectionTitle}>{t('links.broken')}</h4>
                    {result.broken.map(link => (
                        <div key={link.url} className={styles.rec}>
                            <span className={`${styles.impact} ${styles.impact_critical}`}>
                                {link.status === 0 ? t('links.statusError') : link.status}
                            </span>
                            <div className={styles.recBody}>
                                <div className={styles.recTitle}>{link.text || link.href}</div>
                                <div className={styles.recDetail}>{link.url}</div>
                                <button
                                    type="button"
                                    className={styles.smallButton}
                                    onClick={() => onHighlight(selectorFor(link.href))}
                                >
                                    {t('a11y.highlight')}
                                </button>
                            </div>
                        </div>
                    ))}
                </>
            )}

            {result.editWorkspace.length > 0 && (
                <>
                    <h4 className={styles.sectionTitle}>{t('links.editWorkspace')}</h4>
                    {result.editWorkspace.map(link => (
                        <div key={link.href} className={styles.rec}>
                            <span className={`${styles.impact} ${styles.impact_serious}`}>
                                {t('a11y.impacts.serious')}
                            </span>
                            <div className={styles.recBody}>
                                <div className={styles.recTitle}>{link.text || link.href}</div>
                                <div className={styles.recDetail}>{link.href}</div>
                                <button
                                    type="button"
                                    className={styles.smallButton}
                                    onClick={() => onHighlight(selectorFor(link.href))}
                                >
                                    {t('a11y.highlight')}
                                </button>
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

LinksTab.propTypes = {
    result: PropTypes.object.isRequired,
    onHighlight: PropTypes.func.isRequired
};
