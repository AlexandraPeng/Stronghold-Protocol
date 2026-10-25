import { useEffect, useState } from '../../vendor/hooks.module.js';
import { html, Button } from './components.js';
import { net } from '../net.js';
import { toastError } from './toasts.js';
import { t } from '../../../shared/i18n.js';

/** The existing community queue and public rooms, alongside the upstream lobby. */
export function CommunityLobby({ mode, difficulty, uniteStacking }) {
  const [rooms, setRooms] = useState([]);
  const [queued, setQueued] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (net.status === 'online') net.request('room.list', {}).then(r => { if (alive) setRooms(r.rooms || []); }).catch(() => {});
    };
    const off = net.on('match.status', m => setQueued(m.status === 'queued'));
    const found = net.on('match.found', () => setQueued(false));
    const offLobbyStats = net.on('lobby.stats', (stats) => {
      if (alive && Array.isArray(stats?.rooms)) setRooms(stats.rooms);
    });
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { alive = false; clearInterval(timer); off?.(); found?.(); offLobbyStats?.(); };
  }, []);
  const run = async (type, args) => {
    if (busy) return;
    setBusy(true);
    try { await net.request(type, args); if (type === 'match.queue') setQueued(true); if (type === 'match.cancel') setQueued(false); }
    catch (e) { toastError(e); }
    finally { setBusy(false); }
  };
  return html`<section class="community-lobby" aria-label=${t('公开同盟')}>
    <header><strong>${t('公开同盟')}</strong><span>${t('最多 6 人')}</span>
      ${mode === 'coop' ? html`<${Button} size="sm" disabled=${busy} onClick=${() => run(queued ? 'match.cancel' : 'match.queue', queued ? {} : { mode, difficulty, uniteStacking, fillBots: true })}>${queued ? t('取消匹配') : t('快速匹配')}</${Button}>` : null}
    </header>
    <div class="community-lobby__rooms">${rooms.length ? rooms.map(r => html`<button key=${r.code} type="button" disabled=${busy || (!r.inMatch && r.humans >= r.maxSeats)} onClick=${() => run(r.inMatch ? 'room.spectate' : 'room.join', { code: r.code })}>
      <b>${r.name}</b><span>${r.humans}/${r.maxSeats} · ${r.uniteStacking ? t('止境模拟') : r.difficulty}</span><small>${r.inMatch ? t('观战') : t('加入同盟')} · ${r.code}</small>
    </button>`) : html`<p>${t('暂无公开同盟，可创建房间或快速匹配。')}</p>`}</div>
  </section>`;
}
