import React from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from 'react-i18next';
import {Recommendations} from './Recommendations';
import styles from './Tabs.module.css';

export function JahiaTab({result, onHighlightText}) {
    const {t} = useTranslation('page-audit');

    return (
        <div>
            <Recommendations items={result.recommendations} ns="jahia"/>

            <h4 className={styles.sectionTitle}>{t('jahia.summary')}</h4>
            <ul className={styles.statList}>
                {result.pageStatus && (
                    <li>{t('jahia.pageStatus')}: <strong>{t(`jahia.statuses.${result.pageStatus}`, result.pageStatus)}</strong></li>
                )}
                <li>{t('jahia.scanned', {count: result.scanned})}</li>
                {result.activeLanguages.length > 0 && (
                    <li>{t('jahia.languages')}: <strong>{result.activeLanguages.join(', ')}</strong></li>
                )}
            </ul>

            {result.unpublished.length > 0 && (
                <>
                    <h4 className={styles.sectionTitle}>{t('jahia.unpublished')}</h4>
                    {result.unpublished.map(node => (
                        <div key={node.path} className={styles.rec}>
                            <span className={`${styles.impact} ${styles.impact_serious}`}>
                                {t(`jahia.statuses.${node.status}`, node.status)}
                            </span>
                            <div className={styles.recBody}>
                                <div className={styles.recTitle}>{node.path}</div>
                                <div className={styles.recDetail}>{node.type}</div>
                            </div>
                        </div>
                    ))}
                </>
            )}

            {result.untranslated.length > 0 && (
                <>
                    <h4 className={styles.sectionTitle}>{t('jahia.untranslated')}</h4>
                    {result.untranslated.map(node => (
                        <div key={node.path} className={styles.rec}>
                            <span className={`${styles.impact} ${styles.impact_serious}`}>
                                {node.missing.join(', ')}
                            </span>
                            <div className={styles.recBody}>
                                <div className={styles.recTitle}>{node.path}</div>
                                <div className={styles.recDetail}>{node.type}</div>
                            </div>
                        </div>
                    ))}
                </>
            )}

            {result.rawKeys.count > 0 && (
                <>
                    <h4 className={styles.sectionTitle}>{t('jahia.rawKeys')}</h4>
                    {result.rawKeys.samples.map(sample => (
                        <div key={sample.key + sample.text} className={styles.rec}>
                            <span className={`${styles.impact} ${styles.impact_critical}`}>
                                {t('a11y.impacts.critical')}
                            </span>
                            <div className={styles.recBody}>
                                <div className={styles.recTitle}><code>{sample.key}</code></div>
                                <div className={styles.recDetail}>{sample.text}</div>
                                <button
                                    type="button"
                                    className={styles.smallButton}
                                    onClick={() => onHighlightText(sample.key)}
                                >
                                    {t('a11y.highlight')}
                                </button>
                            </div>
                        </div>
                    ))}
                </>
            )}

            {result.placeholders.count > 0 && (
                <>
                    <h4 className={styles.sectionTitle}>{t('jahia.placeholders')}</h4>
                    {result.placeholders.samples.map(sample => (
                        <div key={sample.text} className={styles.rec}>
                            <span className={`${styles.impact} ${styles.impact_serious}`}>
                                {sample.match}
                            </span>
                            <div className={styles.recBody}>
                                <div className={styles.recDetail}>{sample.text}</div>
                                <button
                                    type="button"
                                    className={styles.smallButton}
                                    onClick={() => onHighlightText(sample.text.slice(0, 40))}
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

JahiaTab.propTypes = {
    result: PropTypes.object.isRequired,
    onHighlightText: PropTypes.func.isRequired
};
