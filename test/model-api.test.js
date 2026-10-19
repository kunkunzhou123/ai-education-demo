const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {once}=require('node:events');
const {randomUUID}=require('node:crypto');
process.env.MASTERY_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'masterymap-model-'));
process.env.DEEPSEEK_API_KEY='test-only-not-a-real-key';process.env.ASSESSMENT_API_KEY='';process.env.ASSESSMENT_BASE_URL='';process.env.ASSESSMENT_MODEL='fixture-model';
const {handleDialogue}=require('../lib/dialogue');

test('原生工具循环：引用失败、幂等并发、越权工具及服务失败均受控',async()=>{
  const realFetch=global.fetch;let mode='invalid',calls=0,captured;
  global.fetch=async(url,options)=>{
    if(String(url).startsWith('http://127.0.0.1'))return realFetch(url,options);
    calls++;captured=JSON.parse(options.body);
    if(mode==='failure')return new Response('{}',{status:503});
    await new Promise(resolve=>setTimeout(resolve,20));
    let name,args;
    if(captured.tools.some(t=>t.function.name==='record_assessment')){
      name=mode==='unauthorized'?'run_shell':'record_assessment';
      args={correctness:'correct',evidenceQuotes:[mode==='invalid'?'这句话不存在':'训练好，验证差，可能过拟合。'],demonstrated:['比较泛化差距'],missing:[],misconceptions:[],rationale:'测试用模型响应，不代表真实正确性'};
    }else{name='choose_question';args={taskId:captured.tools.find(t=>t.function.name==='choose_question').function.parameters.properties.taskId.enum[0],reason:'继续覆盖未测能力'};}
    return new Response(JSON.stringify({choices:[{message:{role:'assistant',tool_calls:[{id:randomUUID(),type:'function',function:{name,arguments:JSON.stringify(args)}}]}}],usage:{total_tokens:100}}),{status:200});
  };
  const server=http.createServer((req,res)=>handleDialogue(req,res,new URL(req.url,'http://localhost').pathname));server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}/api/dialogue/sessions`;
  try{
    const session=await (await fetch(base,{method:'POST'})).json(),requestId=randomUUID();
    const answer=()=>fetch(`${base}/${session.id}/answer`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,taskId:session.currentTask.id,answer:'训练好，验证差，可能过拟合。'})});
    assert.equal((await answer()).status,502);
    let restored=await (await fetch(`${base}/${session.id}`)).json();assert.equal(restored.turns.length,0);assert.equal(restored.pendingDraft.answer,'训练好，验证差，可能过拟合。');assert.equal(restored.run.status,'retryable');
    mode='valid';const before=calls;
    const responses=await Promise.all([answer(),answer()]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.ok(calls-before>=1 && calls-before<=2);
    restored=await (await fetch(`${base}/${session.id}`)).json();assert.equal(restored.turns.length,1);assert.equal(restored.turns[0].assessment.model,'fixture-model');assert.equal(restored.budget.reportedTokens,calls*100);
    assert.equal(captured.model,'fixture-model');assert.equal(captured.tool_choice,'required');assert.ok(captured.tools);
    mode='unauthorized';const nextId=randomUUID();
    const nextAnswer=()=>fetch(`${base}/${session.id}/answer`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:nextId,taskId:restored.currentTask.id,answer:'训练好，验证差，可能过拟合。'})});
    const denied=await nextAnswer();assert.equal(denied.status,502);assert.equal((await denied.json()).code,'TOOL_NOT_ALLOWED');
    mode='failure';assert.equal((await nextAnswer()).status,502);assert.equal((await (await fetch(`${base}/${session.id}`)).json()).turns.length,1);
  }finally{global.fetch=realFetch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
