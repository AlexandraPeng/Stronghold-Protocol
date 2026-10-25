import { render } from '../vendor/preact.module.js';
import { html } from '../js/ui/components.js';
import { RelicCatalog } from '../js/ui/relicCatalog.js';
import { data } from '../js/data.js';
import { t } from '../../shared/i18n.js';
await data.loadAll(['assets','items']);
render(html`<main><nav><a href="/?board=3d">← ${t('返回游戏')}</a><a href="https://prts.wiki/w/沉沦者的黑流树海/拟造物质编目" target="_blank" rel="noopener">PRTS Wiki ↗</a></nav><${RelicCatalog}/></main>`,document.getElementById('relic-root'));
