import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpineActor } from '../../public/js/render/spine.js';

test('rapid retarget resumes a stopped attack loop before the idle transition', () => {
  const track = { loop: true, trackTime: 2.1, timeScale: 1 };
  const actor = Object.assign(Object.create(SpineActor.prototype), {
    mode: 'attack', current: 'Attack', clock: 1, attackUntil: 2,
    spine: { state: { tracks: [track] } },
    _attackClip: () => ({ loop: 'Attack' }), dur: () => 1, _hitTime: () => 0.3,
    _play: () => assert.fail('continuous attack should reuse its track'),
  });
  actor.finishAttack();
  assert.equal(track.loop, false);
  actor.clock += 0.05;
  actor.attack(0.08);
  assert.equal(track.loop, true);
  assert.ok(actor.attackUntil > actor.clock + 0.1);
});

for (const once of [true, false]) {
  test(`single attack clips retain non-looping behavior (cast=${once})`, () => {
    const track = { loop: false, trackTime: 0.3, timeScale: 1 };
    const actor = Object.assign(Object.create(SpineActor.prototype), {
      mode: 'attack', current: 'Attack', clock: 1, attackUntil: 2,
      clipPerAttack: !once, wound: true,
      spine: { state: { tracks: [track] } },
      _attackClip: () => ({ loop: 'Attack' }), dur: () => 1, _hitTime: () => 0.3,
    });
    actor.attack(0.08, once);
    assert.equal(track.loop, false);
  });
}
