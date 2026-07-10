import React from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from 'react-i18next';
import {Recommendations} from './Recommendations';
import {ECO_CHECKLIST} from './ecoChecklist';
import styles from './Tabs.module.css';

export function EcodesignTab({result}) {
    const {t} = useTranslation('page-audit');

    const scoreClass = result.passed === result.total ?
        styles.cardGood :
        (result.passed >= result.total * 0.6 ? styles.band_ni : styles.cardBad);

    return (
        <div>
            <div className={styles.cards}>
                <div className={`${styles.card} ${scoreClass}`}>
                    <span className={styles.cardTitle}>{t('eco.score')}</span>
                    <span className={styles.cardValue}>{result.passed}/{result.total}</span>
                    <span className={styles.cardHint}>{t('eco.scoreHint')}</span>
                </div>
                <div className={styles.card}>
                    <span className={styles.cardTitle}>{t('eco.weight')}</span>
                    <span className={styles.cardValue}>{(result.stats.totalBytes / 1024 / 1024).toFixed(2)}</span>
                    <span className={styles.cardHint}>MB</span>
                </div>
                <div className={styles.card}>
                    <span className={styles.cardTitle}>{t('eco.requests')}</span>
                    <span className={styles.cardValue}>{result.stats.requests}</span>
                    <span className={styles.cardHint}>{t('eco.thirdPartyHint', {count: result.stats.thirdParty})}</span>
                </div>
            </div>

            <p className={styles.note}>{t('eco.disclaimer')}</p>

            <Recommendations items={result.recommendations} ns="eco"/>

            <h4 className={styles.sectionTitle}>{t('eco.criteria')}</h4>
            <ul className={styles.statList}>
                {result.criteria.map(c => (
                    <li key={c.key}>
                        <span className={c.ok ? styles.okMark : styles.koMark}>{c.ok ? '✓' : '✗'}</span>
                        {' '}<span className={styles.levelChip}>{t(`eco.families.${c.family}`)}</span>
                        {' '}{t(`eco.checks.${c.key}`)}: <strong>{c.value}</strong>
                    </li>
                ))}
            </ul>

            <h4 className={styles.sectionTitle}>{t('eco.checklist.title')}</h4>
            <p className={styles.note}>{t('eco.checklist.intro')}</p>
            {ECO_CHECKLIST.map(group => (
                <details key={group.family} className={styles.violation}>
                    <summary className={styles.violationSummary}>
                        <span className={styles.levelChip}>{t(`eco.families.${group.family}`)}</span>
                        <span className={styles.violationHelp}>{t(`eco.checklist.families.${group.family}`)}</span>
                        <span className={styles.nodeCount}>{group.items.length}</span>
                    </summary>
                    <div className={styles.violationBody}>
                        {group.items.map(key => (
                            <div key={key} className={styles.node}>
                                <div className={styles.recTitle}>{t(`eco.checklist.items.${key}.title`)}</div>
                                <div className={styles.recDetail}>{t(`eco.checklist.items.${key}.detail`)}</div>
                            </div>
                        ))}
                    </div>
                </details>
            ))}
        </div>
    );
}

EcodesignTab.propTypes = {
    result: PropTypes.object.isRequired
};
