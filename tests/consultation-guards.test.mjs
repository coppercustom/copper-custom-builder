import test from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout, classifyTurnstile, normalizeTrustedIp, allowWindowAttempt } from './consultation-guards.mjs';
test('successful verification within timeout', async () => {
  assert.equal(await withTimeout(async signal => { assert.equal(signal.aborted, false); return 200; }, 100), 200);
});
test('timeout aborts stalled upstream call', async () => {
  let signalRef;
  await assert.rejects(withTimeout(signal => { signalRef=signal; return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')))); }, 10), /aborted/);
  assert.equal(signalRef.aborted,true);
});
test('timer cleared on success and error', async () => {
  let cleared=0;
  const timer={setTimer:()=>1,clearTimer:()=>{cleared++;}};
  await withTimeout(async()=>true,100,timer);
  await assert.rejects(withTimeout(async()=>{throw Error('upstream');},100,timer),/upstream/);
  assert.equal(cleared,2);
});
test('Turnstile rejects invalid, replay-failed, or wrong-host responses',()=>{
  const hosts=['coppercustom.com','www.coppercustom.com'];
  assert.equal(classifyTurnstile({success:true,hostname:'coppercustom.com'},hosts),true);
  for (const v of [null,{}, {success:false,hostname:'coppercustom.com'}, {success:true,hostname:'attacker.example'}, {success:true}]) assert.equal(classifyTurnstile(v,hosts),false);
});
test('unverified and malformed IP identities are rejected',()=>{
  assert.equal(normalizeTrustedIp('192.0.2.1',true),'192.0.2.1');
  for(const ip of ['192.0.2.1, 10.0.0.1','unknown','1.2.3.4\r\nx','']) assert.equal(normalizeTrustedIp(ip,true),null);
  assert.equal(normalizeTrustedIp('192.0.2.1',false),null);
});
test('window boundary and invalid counters',()=>{
  assert.equal(allowWindowAttempt(4,5),true);
  assert.equal(allowWindowAttempt(5,5),false);
  assert.equal(allowWindowAttempt(6,5),false);
  assert.throws(()=>allowWindowAttempt(-1,5));
});
