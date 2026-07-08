import {registry} from '@jahia/ui-extender';

export default function () {
    registry.add('callback', 'page-audit', {
        targets: ['jahiaApp-init:50'],
        callback: async () => {
            const {default: register} = await import('./init');
            register();
        }
    });
    console.info('%c Page Quality Audit is activated', 'color: #00a0e3');
}
