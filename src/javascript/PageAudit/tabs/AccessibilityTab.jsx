import React from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from 'react-i18next';
import styles from './Tabs.module.css';

const LEVELS = ['A', 'AA', 'AAA', 'BP'];

export function AccessibilityTab({result, onHighlight}) {
    const {t} = useTranslation('page-audit');

    return (
        <div>
            <div className={styles.cards}>
                {LEVELS.map(level => {
                    const s = result.summary[level];
                    const ok = s.violations === 0;
                    return (
                        <div key={level} className={`${styles.card} ${ok ? styles.cardGood : styles.cardBad}`}>
                            <span className={styles.cardTitle}>{t(`a11y.levels.${level}`)}</span>
                            <span className={styles.cardValue}>{s.violations}</span>
                            <span className={styles.cardHint}>
                                {t('a11y.passes', {count: s.passes})}
                                {s.incomplete > 0 ? ` · ${t('a11y.incomplete', {count: s.incomplete})}` : ''}
                            </span>
                        </div>
                    );
                })}
            </div>

            <p className={styles.note}>{t('a11y.machineNote')}</p>

            {result.violations.length === 0 && (
                <div className={styles.allGood}>{t('a11y.noViolations')}</div>
            )}

            {result.violations.map(v => (
                <details key={v.id} className={styles.violation}>
                    <summary className={styles.violationSummary}>
                        <span className={`${styles.impact} ${styles[`impact_${v.impact}`]}`}>
                            {t(`a11y.impacts.${v.impact}`)}
                        </span>
                        <span className={styles.levelChip}>{v.level}</span>
                        <span className={styles.violationHelp}>{v.help}</span>
                        <span className={styles.nodeCount}>{v.totalNodes}</span>
                    </summary>
                    <div className={styles.violationBody}>
                        <p>{v.description} (<a href={v.helpUrl} target="_blank" rel="noreferrer">{v.id}</a>)</p>
                        {v.nodes.map((node, i) => (
                            /* eslint-disable-next-line react/no-array-index-key */
                            <div key={i} className={styles.node}>
                                <code className={styles.nodeHtml}>{node.html}</code>
                                {node.failureSummary && (
                                    <p className={styles.failure}>{node.failureSummary}</p>
                                )}
                                <button
                                    type="button"
                                    className={styles.smallButton}
                                    onClick={() => onHighlight(node.target)}
                                >
                                    {t('a11y.highlight')}
                                </button>
                            </div>
                        ))}
                        {v.totalNodes > v.nodes.length && (
                            <p className={styles.note}>
                                {t('a11y.moreElements', {count: v.totalNodes - v.nodes.length})}
                            </p>
                        )}
                    </div>
                </details>
            ))}
        </div>
    );
}

AccessibilityTab.propTypes = {
    result: PropTypes.object.isRequired,
    onHighlight: PropTypes.func.isRequired
};
