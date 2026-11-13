import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const entry = fileURLToPath(new URL('../src/server.js',import.meta.url));

async function startCli(t, settings) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'raven-cli-listen-'));
  // Start the actual CLI without inherited provider credentials, HOST, Render
  // settings, NODE_OPTIONS, or private content paths. Port 0 avoids port races.
  const child = spawn(process.execPath,[entry],{
    cwd:directory,
    env:{PORT:'0',RAVEN_AI_PROVIDER:'simulation',RAVEN_MODEL_CALLS_ENABLED:'0',
      RAVEN_DIALOGUE_STORAGE_PATH:path.join(directory,'store.json'),...settings},
    stdio:['ignore','pipe','pipe'],
  });
  const stopped = new Promise(resolve => {
    child.once('exit',resolve);
    child.once('error',resolve);
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await stopped;
    fs.rmSync(directory,{recursive:true,force:true});
  });
  let output = '', errors = '';
  child.stderr.on('data',chunk => { errors = (errors + chunk).slice(-4096); });
  const address = await new Promise((resolve,reject) => {
    const timeout = setTimeout(() => reject(new Error('CLI did not start: ' + errors)),5000);
    const finish = (error, value) => {
      clearTimeout(timeout);
      error ? reject(error) : resolve(value);
    };
    child.once('error',error => finish(error));
    child.once('exit',code => finish(new Error(`CLI exited (${code}): ${errors}`)));
    child.stdout.on('data',chunk => {
      output = (output + chunk).slice(-4096);
      const bound = /listening on ([\d.]+):(\d+)/.exec(output);
      if (bound) finish(null,{host:bound[1],port:Number(bound[2])});
    });
  });
  return {...address,root:`http://${address.host === '0.0.0.0' ? '127.0.0.1' : address.host}:${address.port}`};
}

for (const {name,settings,host} of [
  {name:'local CLI stays on loopback',settings:{},host:'127.0.0.1'},
  {name:'Render CLI accepts external connections by default',settings:{RENDER:'true'},host:'0.0.0.0'},
  {name:'explicit HOST overrides the Render default',settings:{RENDER:'true',HOST:'127.0.0.1'},host:'127.0.0.1'},
  {name:'a false Render flag keeps the local default',settings:{RENDER:'false'},host:'127.0.0.1'},
]) {
  test(name,{timeout:10000},async t => {
    const server = await startCli(t,settings);
    assert.equal(server.host,host);
    assert.ok(Number.isInteger(server.port) && server.port > 0);
    const health = await fetch(server.root + '/healthz',{signal:AbortSignal.timeout(3000)});
    assert.equal(health.status,200);
    assert.deepEqual(await health.json(),{status:'ok'});
    const response = await fetch(server.root + '/api/config',{signal:AbortSignal.timeout(3000)});
    assert.equal(response.status,200);
    const config = await response.json();
    assert.equal(config.provider,'simulation');
    assert.equal(config.controls.providerCallsEnabled,false);
    assert.equal(config.persistence,'disk-file');
  });
}
