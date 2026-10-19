const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {once}=require('node:events');
const {randomUUID}=require('node:crypto');
process.env.MASTERY_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'masterymap-api-'));
process.env.DEEPSEEK_API_KEY='';process.env.ASSESSMENT_API_KEY='';
const {handleDialogue,validateAssessment}=require('../lib/dialogue');
const {readRows}=require('../lib/harness/store');

test('引用校验拒绝虚构、缺失和与判分矛盾的证据',()=>{
  const data={correctness:'correct',evidenceQuotes:['不在回答中'],demonstrated:['比较表现'],missing:[],misconceptions:[],rationale:'解释完整'};
  assert.throws(()=>validateAssessment(data,'实际回答'),/原话/);
  data.evidenceQuotes=[];assert.throws(()=>validateAssessment(data,'实际回答'),/缺少/);
  data.evidenceQuotes=['实际回答'];assert.equal(validateAssessment(data,'实际回答').correctness,'correct');
  data.misconceptions=['明确错误'];assert.throws(()=>validateAssessment(data,'实际回答'),/矛盾/);
});

test('五能力闭环：帮助、幂等、阶段隔离、盲标注、延时检查及日志导出',async()=>{
  const server=http.createServer((req,res)=>handleDialogue(req,res,new URL(req.url,'http://localhost').pathname));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}/api/dialogue/sessions`;
  let id;
  const call=async(action,body)=>{
    const response=await fetch(action==='create'?base:`${base}/${id}${action?'/'+action:''}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  };
  const previousNow=Date.now;
  try{
    let result=await call('create',{strategy:'adaptive',participantId:'learner-01'});id=result.data.id;
    assert.equal(result.status,201);assert.equal(result.data.concepts.length,5);
    assert.equal(result.data.currentTask.criteria,undefined);
    assert.equal((await call('teach',{conceptId:'gap'})).status,409);
    result=await call('hint',{taskId:result.data.currentTask.id,level:2});assert.equal(result.status,200);
    let first=true;
    while(result.data.phase==='diagnostic'){
      const taskId=result.data.currentTask.id,requestId=randomUUID(),answer='我不知道怎么回答';
      result=await call('answer',{taskId,requestId,answer});assert.equal(result.status,200,JSON.stringify(result.data));
      if(first){
        const replay=await call('answer',{taskId,requestId,answer});assert.equal(replay.status,200);assert.equal(replay.data.turns.length,1);
        assert.equal((await call('answer',{taskId,requestId,answer:'这是一份不同的回答。'})).status,409);
        assert.equal((await call('answer',{taskId,requestId:randomUUID(),answer})).status,409);first=false;
      }
    }
    assert.equal(result.data.turns.length,10);assert.ok(result.data.concepts.every(c=>c.status==='unknown'));
    assert.equal(result.data.turns[0].support.level,2);
    assert.ok(result.data.trace.some(t=>t.event==='checkpoint'));
    const restored=await call('');assert.equal(restored.data.turns.length,10);assert.equal(restored.data.participantId,'learner-01');
    const review=await call('review');assert.equal(review.status,200);
    assert.equal(review.data.asOfTurnId,10);
    for(const forbidden of ['"assessment"','"score"','"diagnosis"','"modelStatus"','"humanMastery"'])assert.ok(!JSON.stringify(review.data).includes(forbidden),forbidden);
    assert.equal((await call('annotations',{turnId:1,correctness:'insufficient',annotator:'test-teacher',blind:true,asOfTurnId:9})).status,409);
    const labelled=await call('annotations',{turnId:1,correctness:'insufficient',annotator:'test-teacher',blind:true,asOfTurnId:review.data.asOfTurnId,note:'独立标注界面测试'});
    assert.equal(labelled.status,200);assert.deepEqual(Object.keys(labelled.data).sort(),['conceptId','saved','sessionId','turnId']);
    assert.equal((await call('mastery-annotations',{conceptId:'gap',status:'unknown',annotator:'test-teacher',blind:true,note:'尚无理解证据'})).status,200);
    result=await call('teach',{conceptId:'gap'});assert.equal(result.data.phase,'learning');assert.equal(result.data.turns.length,10);
    result=await call('posttest',{});assert.equal((await call('hint',{taskId:result.data.currentTask.id,level:1})).status,409);
    while(result.data.phase==='posttest'){result=await call('answer',{taskId:result.data.currentTask.id,requestId:randomUUID(),answer:'我不知道怎么回答'});assert.equal(result.status,200);}
    assert.equal(result.data.turns.length,12);assert.ok(result.data.retention.dueAt);
    assert.equal((await call('mastery-annotations',{conceptId:'gap',status:'unknown',annotator:'test-teacher',blind:true,asOfTurnId:review.data.asOfTurnId})).status,409);
    assert.equal((await call('delayed',{})).status,409);
    Date.now=()=>previousNow()+25*3600000;
    result=await call('delayed',{});assert.equal(result.status,200);
    while(result.data.phase==='delayed'){result=await call('answer',{taskId:result.data.currentTask.id,requestId:randomUUID(),answer:'我不知道怎么回答'});assert.equal(result.status,200);}
    assert.equal(result.data.turns.length,14);assert.ok(result.data.retention.completedAt);
    assert.equal((await call('teach',{conceptId:'complexity'})).status,409);
    assert.equal((await call('delayed',{})).status,409);
    const exported=await fetch(`${base}/${id}/export`),rows=(await exported.text()).trim().split('\n').map(JSON.parse);
    assert.equal(rows.filter(r=>r.event==='answer_assessed').length,14);
    assert.ok(rows.every(r=>!r.projection && r.exportHash));
    assert.ok(rows.some(r=>r.event==='human_annotation' && r.humanLabel.blind));
    const annotation=rows.find(r=>r.event==='human_annotation');
    assert.equal(annotation.asOfTurnId,10);assert.deepEqual(annotation.evidenceTurnIds,[1]);assert.equal(annotation.participantId,'learner-01');
    assert.ok(rows.some(r=>r.event==='mastery_annotation' && r.humanLabel.note==='尚无理解证据'));
    assert.ok((await readRows(id)).length>14);
  }finally{Date.now=previousNow;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
