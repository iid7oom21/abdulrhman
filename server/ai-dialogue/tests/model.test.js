import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGroundedReply } from '../src/model.js';
import { providerFromEnv } from '../src/provider.js';

const received = {actor:'jonas',materials:[{id:'m1',type:'statement',text:'قلت إن الباب كان مغلقاً.',author:'player'}]};
const reply = selection => new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(selection)}}]}));

test('empty knowledge never calls the compatible model', async () => {
  let called = false;
  const generate = createGroundedReply({apiKey:'TEST_ONLY',fetchImpl:async()=>{called=true;throw new Error('unexpected call');}});
  const result = await generate('claire','من ضرب فيكتور؟');
  assert.equal(called,false);assert.equal(result.refused,true);assert.equal(result.source,'deterministic-fallback');
});

test('compatible API retains /v1 and receives only attributed recipient materials', async () => {
  let payload, url, headers;
  const generate = createGroundedReply({apiKey:'TEST_ONLY',fetchImpl:async(endpoint,options)=>{
    url=endpoint;payload=JSON.parse(options.body);headers=options.headers;
    return reply({action:'received_materials',materialIds:['m1']});
  }});
  const result = await generate('jonas','وش وصلك؟',received);
  assert.equal(url,'https://api.x.ai/v1/chat/completions');
  assert.equal(headers.Authorization,'Bearer TEST_ONLY');assert.equal(payload.store,false);
  assert.equal(payload.response_format.json_schema.strict,true);
  assert.equal(JSON.stringify(payload).includes('TEST_ONLY'),false);
  const sent=JSON.parse(payload.messages[1].content);
  assert.deepEqual(sent.receivedPlayerMaterials,received.materials);
  assert.equal(sent.allowedKnowledge,undefined);
  assert.equal(result.source,'grounded-model');assert.equal(result.refused,false);
  assert.match(result.text,/قلت إن الباب كان مغلقاً/);assert.match(result.text,/وليست إثباتًا/);
});

test('network failure remains unknown and is not relabeled as a successful refusal', async () => {
  let calls=0;
  const generate=createGroundedReply({apiKey:'TEST_ONLY',fetchImpl:async()=>{calls++;throw new Error('private provider message');}});
  await assert.rejects(()=>generate('jonas','وش وصلك؟',received),error=>error.code==='provider_unavailable'&&error.outcomeUnknown===true&&!error.message.includes('private'));
  assert.equal(calls,1);
});

test('compatible model cannot inject free text, unknown IDs, tool calls or a truncated result', async () => {
  for (const body of [
    {choices:[{finish_reason:'stop',message:{content:'{"text":"invented testimony","refused":false}'}}]},
    {choices:[{finish_reason:'stop',message:{content:'{"action":"received_materials","materialIds":["private"]}'}}]},
    {choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'fake'}]}}]},
    {choices:[{finish_reason:'length',message:{content:'{}'}}]},
  ]) {
    const generate=createGroundedReply({apiKey:'TEST_ONLY',fetchImpl:async()=>new Response(JSON.stringify(body))});
    await assert.rejects(()=>generate('jonas','x',received),error=>error.code==='provider_invalid_output');
  }
});

test('existing model environment remains supported, explicit simulation disables all calls', () => {
  assert.deepEqual(providerFromEnv({RAVEN_MODEL_KEY:'TEST_ONLY'}).info,{provider:'compatible',model:'grok-3'});
  assert.deepEqual(providerFromEnv({RAVEN_MODEL_KEY:'TEST_ONLY',RAVEN_AI_PROVIDER:'simulation'}).info,{provider:'simulation',model:null});
  for(const baseUrl of ['http://example.test/v1','https://user:pass@example.test/v1','https://example.test/v1?token=x']) {
    assert.throws(()=>createGroundedReply({apiKey:'TEST_ONLY',baseUrl}),/invalid_model_base/);
  }
});
