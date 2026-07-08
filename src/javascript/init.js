import React from 'react';
import i18next from 'i18next';
import {registry} from '@jahia/ui-extender';
import {PageAuditAction} from './PageAudit/PageAuditAction';
import en from '../main/resources/javascript/locales/en.json';
import fr from '../main/resources/javascript/locales/fr.json';

const NS = 'page-audit';

function registerTranslations() {
    [['en', en], ['fr', fr]].forEach(([lang, resource]) => {
        if (!i18next.hasResourceBundle(lang, NS)) {
            i18next.addResourceBundle(lang, NS, resource[NS], true, true);
        }
    });
}

function register() {
    const buttonIcon = window.jahia?.moonstone?.toIconComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">' +
        '<path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/>' +
        '<path d="M10.5 16.2 7 12.7l1.4-1.4 2.1 2.1 5.1-5.1L17 9.7z" fill="#fff"/>' +
        '</svg>'
    );

    registry.add('action', 'pageAudit', {
        targets: ['headerPrimaryActions:900'],
        buttonIcon,
        buttonLabel: `${NS}:action.open`,
        component: PageAuditAction
    });
}

export default function () {
    registerTranslations();
    register();
}
