const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {runAgent,tool}=require('../lib/harness/runner');
const {buildMemory}=require('../lib/harness/memory');
const {loadSkill}=require('../lib/harness/skills');
const {save,readRows,withLock}=require('../lib/harness/store');

test('技能角色白名单不允许路径穿越或跨角色加载',async()=>{
  assert.ok((await loadSkill('evaluator','evidence-assessment')).digest);
  await assert.rejects(()=>loadSkill('evaluator','../../.env'),/不能加载/);
  await assert.rejects(()=>loadSkill('evaluator','guided-learning'),/不能加载/);
});
test('上下文压缩保留引用而不更改原始学生原话',()=>{
  const session={turns:Array.from({length:30},(_,i)=>({turnId:i+1,task:{prompt:'题目'+i,conceptId:'gap',phase:'diagnostic'},answer:'原话'.repeat(1000),assessment:{correctness:'partial'},support:{level:1}}))};
  const before=JSON.stringify(session),memory=buildMemory(session,3500);
  assert.ok(memory.compacted);assert.ok(memory.chars<=3500);assert.ok(memory.digest);assert.equal(JSON.stringify(session),before);assert.ok(memory.omittedTurnIds.length);
});
test('慢工具超时后不提交迟到checkpoint，模型调用预算硬限生效',async()=>{
  const original=global.fetch;
  global.fetch=async()=>new Response(JSON.stringify({choices:[{message:{tool_calls:[{id:'call-1',type:'function',function:{name:'slow',arguments:'{}'}}]}}]}),{status:200});
  const cfg={endpoint:'https://fixture.invalid/chat',key:'fixture',maxSteps:3,maxModelCalls:2,maxOutputTokens:256,maxContextChars:4000,maxSessionTokens:20000,modelTimeoutMs:1000};
  let checkpointed=false;
  const session={budget:{reservedTokens:0,modelCalls:0,reportedTokens:0},run:{deadline:Date.now()+70,modelCalls:0,toolCalls:0}};
  try{
    await assert.rejects(()=>runAgent({role:'evaluator',model:'fixture',system:'测试',input:{},tools:[tool('slow','测试超时',{},[],async()=>{await new Promise(r=>setTimeout(r,150));return {terminal:true,value:'late'};})],cfg,session,signal:AbortSignal.timeout(70),onEvent:async()=>{},checkpoint:async()=>{checkpointed=true;}}),e=>e.code==='RUN_TIMEOUT');
    assert.equal(checkpointed,false);
    session.run={deadline:Date.now()+1000,modelCalls:2,toolCalls:0};
    await assert.rejects(()=>runAgent({role:'evaluator',model:'fixture',system:'测试',input:{},tools:[],cfg,session,signal:AbortSignal.timeout(1000),onEvent:async()=>{},checkpoint:async()=>{}}),e=>e.code==='MODEL_BUDGET_EXCEEDED');
  }finally{global.fetch=original;}
});
test('原子快照写失败不覆盖旧日志，哈希降级与并发写入被拒绝',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'masterymap-store-'));
  process.env.MASTERY_DATA_DIR=dir;
  const session={id:randomUUID(),domainVersion:'overfitting-v2.0.0',revision:0,turns:[]};
  await save(session,{event:'session_created'});
  const original=fs.rename;
  fs.rename=async()=>{throw Object.assign(new Error('injected disk failure'),{code:'EIO'});};
  try{await assert.rejects(()=>save(session,{event:'injected'}),/injected/);}finally{fs.rename=original;}
  assert.equal((await readRows(session.id)).length,1);assert.equal(session.revision,1);
  let release;
  const locked=withLock(session.id,()=>new Promise(resolve=>{release=resolve;}));
  while(!release)await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(()=>withLock(session.id,async()=>{}),e=>e.code==='SESSION_LOCKED');release();await locked;
  const file=path.join(dir,`${session.id}.jsonl`),rows=await readRows(session.id);
  rows[0].schemaVersion=1;rows[0].projection.turns=['tampered'];await fs.writeFile(file,JSON.stringify(rows[0])+'\n');
  await assert.rejects(()=>readRows(session.id),e=>e.code==='CORRUPT_LOG');
});
