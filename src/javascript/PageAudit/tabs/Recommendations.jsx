import React from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from 'react-i18next';
import styles from './Tabs.module.css';

/**
 * Shared recommendations block: severity chip + what to fix + how.
 * Items come from the analyzers as {key, severity, params}; text lives in
 * the locale bundles under <ns>.recs.<key>.title / .detail.
 */
export function Recommendations({items, ns}) {
    const {t} = useTranslation('page-audit');

    return (
        <div className={styles.recList}>
            <h4 className={styles.sectionTitle}>{t('recs.title')}</h4>
            {items.length === 0 && (
                <div className={styles.allGood}>{t('recs.none')}</div>
            )}
            {items.map(rec => (
                <div key={rec.key} className={styles.rec}>
                    <span className={`${styles.impact} ${styles[`impact_${rec.severity}`]}`}>
                        {t(`a11y.impacts.${rec.severity}`)}
                    </span>
                    <div className={styles.recBody}>
                        <div className={styles.recTitle}>{t(`${ns}.recs.${rec.key}.title`, rec.params)}</div>
                        <div className={styles.recDetail}>{t(`${ns}.recs.${rec.key}.detail`, rec.params)}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

Recommendations.propTypes = {
    items: PropTypes.array.isRequired,
    ns: PropTypes.string.isRequired
};
