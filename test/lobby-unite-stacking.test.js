import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.js';
import { TestClient } from './helpers/wsClient.js';
import { StubMatch } from '../server/match/StubMatch.js';

class CaptureMatch extends StubMatch {
  static options;
  constructor(opts) { super(opts); CaptureMatch.options = opts; }
}
test('new mode survives create, join, reconnect and start; difficulty stays ultimate', async () => {
  const srv = await startServer({ port: 0, host: '127.0.0.1', MatchClass: CaptureMatch,
    log: { info() {}, warn() {}, error() {}, debug() {} } });
  const clients = [];
  const connect = async (name, token) => {
    const c = await TestClient.connect(`ws://127.0.0.1:${srv.port}/ws`); clients.push(c);
    const welcome = await c.hello(name, token); return { c, welcome };
  };
  try {
    const { c: host } = await connect('Host');
    assert.equal((await host.request({ t: 'room.create', mode: 'solo', difficulty: 'ABYSS', uniteStacking: true })).code, 'BAD_MSG');
    assert.equal((await host.request({ t: 'room.create', mode: 'coop', difficulty: 'FUNNY', uniteStacking: true })).t, 'ok');
    const room = await host.waitFor('room.state', (s) => s.uniteStacking);
    assert.equal(room.difficulty, 'ABYSS');
    assert.equal((await host.request({ t: 'room.setDifficulty', difficulty: 'NORMAL' })).code, 'BAD_MSG');
    const { c: guest, welcome } = await connect('Guest');
    await guest.request({ t: 'room.join', code: room.code });
    assert.equal((await guest.waitFor('room.state')).uniteStacking, true);
    await guest.terminate();
    const { c: back } = await connect('Guest', welcome.token);
    assert.equal((await back.waitFor('room.state')).uniteStacking, true);
    await back.request({ t: 'room.ready', ready: true });
    assert.equal((await host.request({ t: 'room.start' })).t, 'ok');
    assert.equal(CaptureMatch.options.uniteStacking, true);
    assert.equal(CaptureMatch.options.modeId, 'mode_multi_abyss');
  } finally {
    await Promise.all(clients.map((c) => c.terminate()));
    await srv.close();
  }
});

test('six real websocket players can join and start; a seventh is refused', async () => {
 const srv=await startServer({port:0,host:'127.0.0.1',MatchClass:CaptureMatch,log:{info(){},warn(){},error(){},debug(){}}});
 const clients=[];
 try {
  for(let i=0;i<7;i++){const c=await TestClient.connect(`ws://127.0.0.1:${srv.port}/ws`);clients.push(c);await c.hello('Player'+i);}
  const host=clients[0];
  await host.request({t:'room.create',mode:'coop',difficulty:'ABYSS',uniteStacking:true});
  const room=await host.waitFor('room.state');
  for(const c of clients.slice(1,6)){assert.equal((await c.request({t:'room.join',code:room.code})).t,'ok');await c.request({t:'room.ready',ready:true});}
  assert.equal((await clients[6].request({t:'room.join',code:room.code})).code,'ROOM_FULL');
  assert.equal((await host.request({t:'room.start'})).t,'ok');
  assert.equal(CaptureMatch.options.seats.length,6);
  assert.deepEqual(CaptureMatch.options.seats.map(s=>s.seat),[0,1,2,3,4,5]);
 }finally{await Promise.all(clients.map(c=>c.terminate()));await srv.close();}
});
