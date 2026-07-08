import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from 'react-i18next';
import {fetchAiStatus} from '../analyzers/aiReview';
import styles from './Tabs.module.css';

export function AiTab({review, phase, error, onGenerate, onHighlightText}) {
    const {t} = useTranslation('page-audit');
    const [status, setStatus] = useState(null);

    useEffect(() => {
        let cancelled = false;
        fetchAiStatus()
            .then(s => !cancelled && setStatus(s))
            .catch(() => !cancelled && setStatus({enabled: false, unreachable: true}));
        return () => {
            cancelled = true;
        };
    }, []);

    if (!status) {
        return (
            <div className={styles.note}>{t('ai.checking')}</div>
        );
    }

    if (!status.enabled) {
        return (
            <div>
                <p className={styles.note}>{t('ai.notConfigured')}</p>
                <code className={styles.nodeHtml}>
                    digital-factory-data/karaf/etc/org.jahia.se.modules.pageaudit.cfg
                </code>
            </div>
        );
    }

    return (
        <div>
            <p className={styles.note}>
                {t('ai.intro', {provider: status.provider, model: status.model})}
            </p>

            {phase !== 'running' && (
                <button type="button" className={styles.smallButton} onClick={onGenerate}>
                    {review ? t('ai.regenerate') : t('ai.generate')}
                </button>
            )}

            {phase === 'running' && (
                <div className={styles.note}>{t('ai.generating')}</div>
            )}

            {phase === 'error' && (
                <div className={styles.recList}>
                    <div className={`${styles.rec} ${styles.cardBad}`}>
                        <div className={styles.recBody}>
                            <div className={styles.recTitle}>{t('ai.error')}</div>
                            <div className={styles.recDetail}>{error}</div>
                        </div>
                    </div>
                </div>
            )}

            {review && (
                <>
                    {review.summary && (
                        <>
                            <h4 className={styles.sectionTitle}>{t('ai.summary')}</h4>
                            <p>{review.summary}</p>
                        </>
                    )}

                    <h4 className={styles.sectionTitle}>{t('recs.title')}</h4>
                    {review.recommendations.length === 0 && (
                        <div className={styles.allGood}>{t('recs.none')}</div>
                    )}
                    {review.recommendations.map((rec, i) => (
                        /* eslint-disable-next-line react/no-array-index-key */
                        <div key={i} className={styles.rec}>
                            <span className={`${styles.impact} ${styles[`impact_${rec.severity}`]}`}>
                                {t(`a11y.impacts.${rec.severity}`)}
                            </span>
                            <div className={styles.recBody}>
                                <div className={styles.recTitle}>
                                    <span className={styles.levelChip}>{t(`ai.categories.${rec.category}`)}</span>
                                    {' '}{rec.title}
                                </div>
                                <div className={styles.recDetail}>{rec.detail}</div>
                                {rec.wording && (
                                    <>
                                        <code className={styles.nodeHtml}>{rec.wording}</code>
                                        <button
                                            type="button"
                                            className={styles.smallButton}
                                            onClick={() => onHighlightText(rec.wording)}
                                        >
                                            {t('a11y.highlight')}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}

                    <p className={styles.note}>
                        {t('ai.poweredBy', {provider: review.provider, model: review.model})}
                        {' · '}{t('ai.disclaimer')}
                    </p>
                </>
            )}
        </div>
    );
}

AiTab.propTypes = {
    review: PropTypes.object,
    phase: PropTypes.string.isRequired,
    error: PropTypes.string,
    onGenerate: PropTypes.func.isRequired,
    onHighlightText: PropTypes.func.isRequired
};
