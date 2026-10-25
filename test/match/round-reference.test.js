import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundReference } from '../../public/workshop/round-reference.js';
test('round reference follows draft counts, separates movement slots and protects leader actions',()=>{
 const wave={id:'test',routes:[{motion:'WALK'},{motion:'FLY'}],spawns:[{key:'a',routeIndex:0,count:2},{key:'b',routeIndex:1,count:3},{key:'boss',tag:'boss',routeIndex:0,count:1}]};
 const before=JSON.stringify(wave),config={templates:{test:{0:{count:5,time:20},2:{count:99}}}};
 const r=roundReference(wave,config);assert.equal(r.walk,5);assert.equal(r.fly,3);assert.equal(r.actions[0].time,20);assert.equal(r.actions[2].count,1);assert.equal(JSON.stringify(wave),before);
});
