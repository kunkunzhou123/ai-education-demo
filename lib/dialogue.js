const {randomUUID}=require('node:crypto');
const curriculum=require('./curriculum');
const legacy=require('./domain');
const {config}=require('./harness/config');
const {fail,correctness,validateAssessment}=require('./harness/schema');
const {readRows,save,withLock,digest}=require('./harness/store');
const education=require('./harness/education');

const now=()=>new Date().toISOString();
function domain(session){return session.domainVersion===curriculum.VERSION?curriculum:legacy;}
function retention(session){
  const dueAt=session.retention?.dueAt || null;
  return {...session.retention,dueAt,available:!!dueAt && Date.now()>=Date.parse(dueAt) && !session.retention?.completedAt};
}
function view(session){
  const d=domain(session),cfg=config();
  const run=session.run?{id:session.run.id,status:session.run.status,retryable:session.run.status==='retryable',role:session.run.role,modelCalls:session.run.modelCalls,toolCalls:session.run.toolCalls,error:session.run.error || null,startedAt:session.run.startedAt,completedAt:session.run.completedAt || null}:null;
  const result={id:session.id,topic:session.topic,createdAt:session.createdAt,participantId:session.participantId || null,strategy:session.strategy || 'legacy',revision:session.revision || 0,phase:session.phase,currentTask:d.publicTask(d.taskById(session.currentTaskId)),concepts:d.CONCEPTS.map(({id,label,objective})=>({id,label,objective,...d.conceptSummary(session,id)})),turns:session.turns.map(t=>({...t,task:d.publicTask(t.task)})),diagnosis:session.diagnosis,lessons:session.lessons,activeConcept:session.activeConcept,provider:cfg.provider,maxDiagnosticTurns:10,run,budget:session.budget,trace:session.trace || [],retention:retention(session),supports:session.supports || {},humanMastery:session.humanMastery || {},legacy:d===legacy};
  if(session.run && session.run.status!=='completed' && session.run.input)result.pendingDraft={taskId:session.run.taskId,answer:session.run.input.answer,requestId:session.run.requestId};
  result.requestTimeoutMs=cfg.runTimeoutMs+5000;
  // A draft assessment is checkpointed privately, never exposed as accepted evidence.
  return result;
}
function blindView(session){
  const d=domain(session);
  return {sessionId:session.id,phase:session.phase,asOfTurnId:session.turns.length,turns:session.turns.map(t=>({turnId:t.turnId,task:d.publicTask(t.task),answer:t.answer,support:t.support || {level:0,answerSeen:false}})),concepts:d.CONCEPTS.map(c=>({id:c.id,label:c.label,objective:c.objective,rubric:c.rubric || null}))};
}
async function parseBody(req){
  let size=0,chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>32000)throw fail('请求内容过大',413);chunks.push(chunk);}
  if(!size)return {};
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail('请求必须为 JSON');}
  if(!body || typeof body!=='object' || Array.isArray(body))throw fail('请求必须为 JSON 对象');
  return body;
}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function anonymousId(value){
  if(value===undefined || value==='')return null;
  if(typeof value!=='string' || !/^[A-Za-z0-9_-]{1,50}$/.test(value))throw fail('学习者代号仅使用 1–50 位英文字母、数字、下划线或连字符');
  return value;
}
function trace(session,event,detail={}){
  const entry={event,detail,timestamp:now()};session.trace=[...(session.trace || []),entry].slice(-80);return entry;
}
async function checkpointEvent(session,event,detail={},options={}){
  const entry=trace(session,event,detail);
  await save(session,{event:'run_event',runId:session.run?.id,...entry},options);
}
async function answer(session,body){
  const task=curriculum.taskById(session.currentTaskId);
  const text=typeof body.answer==='string'?body.answer.trim():'';
  if(text.length<2 || text.length>3000)throw fail('请输入 2 至 3000 字的回答');
  const requestId=body.requestId || digest({taskId:body.taskId,answer:text});
  if(typeof requestId!=='string' || !/^[A-Za-z0-9_-]{8,100}$/.test(requestId))throw fail('提交编号无效');
  const inputHash=digest({taskId:body.taskId,answer:text});
  const completed=(session.requests || {})[requestId];
  if(completed){if(completed.inputHash!==inputHash)throw fail('同一提交编号不能用于不同回答',409,'IDEMPOTENCY_CONFLICT');return;}
  if(!task || !['diagnostic','posttest','delayed'].includes(session.phase) || body.taskId!==task.id)throw fail('题目已更新，请刷新会话',409,'STALE_TASK');
  const previous=session.run;
  if(previous?.status==='blocked')throw fail('本轮预算或上下文限制已达到，请导出记录或新建会话',429,'RUN_BLOCKED');
  if(previous && previous.status!=='completed' && previous.requestId!==requestId && previous.taskId===task.id)throw fail('请先重试上一份回答；需要修改时新建诊断',409,'PENDING_RUN');
  if(previous?.requestId===requestId && previous.inputHash!==inputHash)throw fail('重试时请保留原回答，或新建诊断',409,'IDEMPOTENCY_CONFLICT');
  const cfg=config();
  const resuming=previous?.requestId===requestId;
  if(!resuming)session.run={id:randomUUID(),requestId,inputHash,taskId:task.id,status:'running',startedAt:now(),modelCalls:0,toolCalls:0,checkpoint:{},input:{answer:text,support:structuredClone(session.supports[task.id] || {level:0,answerSeen:false,hints:[]})}};
  session.run.status='running';session.run.deadline=Date.now()+cfg.runTimeoutMs;session.run.error=null;
  const signal=AbortSignal.timeout(cfg.runTimeoutMs);
  await checkpointEvent(session,resuming?'run_resumed':'run_started',{requestId,taskId:task.id});
  const support=structuredClone(session.run.input.support);
  const onEvent=(event,detail)=>checkpointEvent(session,event,detail,{signal});
  try{
    session.run.role='evaluator';
    let assessment=session.run.checkpoint.assessment;
    if(!assessment)assessment=await education.evaluate({session,task,answer:text,support,onEvent,signal,curriculum,checkpoint:async value=>{session.run.checkpoint.assessment=value;await checkpointEvent(session,'checkpoint',{role:'evaluator',saved:'assessment'},{signal});}});
    const turn={turnId:session.turns.length+1,task,answer:text,support,assessment,answeredAt:now(),humanLabel:null};
    const prospective={...session,turns:[...session.turns,turn]};
    let nextId=null;
    if(session.phase==='diagnostic'){
      session.run.role='planner';
      if(Object.hasOwn(session.run.checkpoint,'nextTaskId'))nextId=session.run.checkpoint.nextTaskId;
      else nextId=await education.plan({session:prospective,lastTask:task,assessment,onEvent,signal,curriculum,checkpoint:async value=>{session.run.checkpoint.nextTaskId=value;await checkpointEvent(session,'checkpoint',{role:'planner',saved:'nextTaskId'},{signal});}});
    }else{
      const phase=session.phase;
      nextId=curriculum.TASKS.find(t=>t.phase===phase && (phase==='delayed'?Object.hasOwn(session.lessons,t.conceptId):t.conceptId===task.conceptId) && !prospective.turns.some(turn=>turn.task.id===t.id))?.id || null;
    }
    if(signal.aborted)throw fail('本轮运行超时，检查点已保留',504,'RUN_TIMEOUT');
    // Build the accepted turn on a separate projection. A failed final write
    // must not accidentally accept it through the subsequent run_failed event.
    const committed=structuredClone(session);
    committed.turns.push(turn);committed.currentTaskId=nextId;
    if(!nextId){
      if(committed.phase==='diagnostic')committed.diagnosis=curriculum.CONCEPTS.map(c=>curriculum.conceptSummary(committed,c.id));
      if(committed.phase==='posttest'){
        committed.retention ||= {};
        // A single retention batch is due after the most recent teaching check.
        committed.retention.dueAt=new Date(Date.now()+cfg.retentionHours*3600000).toISOString();
      }
      if(committed.phase==='delayed')committed.retention.completedAt=now();
      committed.phase='diagnosed';
    }
    committed.requests ||= {};committed.requests[requestId]={inputHash,turnId:turn.turnId,completedAt:now()};
    committed.run.status='completed';committed.run.role=null;committed.run.completedAt=now();
    trace(committed,'paused',{reason:nextId?'等待学生亲自作答':'本阶段已完成，不自动替学生继续'});
    await save(committed,{event:'answer_assessed',runId:committed.run.id,requestId,...turn,task:{...curriculum.publicTask(task),rubric:task.criteria.map(c=>c.label)},strategy:committed.strategy,participantId:committed.participantId,context:committed.turns.slice(0,-1).map(t=>({turnId:t.turnId,question:t.task.prompt,answer:t.answer,phase:t.task.phase,support:t.support})),nextQuestion:curriculum.publicTask(curriculum.taskById(nextId))},{signal});
    Object.assign(session,committed);
  }catch(e){
    session.run.status=e.status===429 || e.code==='CONTEXT_LIMIT'?'blocked':'retryable';session.run.error={code:e.code || (e.name==='TimeoutError'?'MODEL_TIMEOUT':'RUN_FAILED'),message:e.status?e.message:'模型暂不可用，运行检查点已保留'};
    await checkpointEvent(session,'run_failed',{code:session.run.error.code});
    throw e;
  }
}
function annotate(session,action,body){
  if(session.phase!=='diagnosed')throw fail('请完成当前诊断或复测后再标注',409);
  if(body.asOfTurnId!==undefined && body.asOfTurnId!==session.turns.length)throw fail('学习证据已变化，请刷新独立标注页面后再提交',409,'REVIEW_CHANGED');
  if(typeof body.annotator!=='string' || !body.annotator.trim() || body.annotator.length>80)throw fail('请输入标注者姓名或代号');
  const d=domain(session);
  if(action==='annotations'){
    const turn=session.turns.find(t=>t.turnId===body.turnId);
    if(!turn || !correctness.includes(body.correctness))throw fail('轮次或人工判分无效');
    if(body.evidenceQuote && (typeof body.evidenceQuote!=='string' || !turn.answer.includes(body.evidenceQuote)))throw fail('人工证据引用必须来自该轮回答');
    if(body.note && (typeof body.note!=='string' || body.note.length>1000))throw fail('标注说明过长');
    const humanLabel={correctness:body.correctness,annotator:body.annotator.trim(),evidenceQuote:body.evidenceQuote || null,note:body.note || '',labeledAt:now(),blind:body.blind===true};
    turn.humanLabel=humanLabel;
    return {event:'human_annotation',turnId:turn.turnId,humanLabel,modelCorrectness:turn.assessment.correctness,asOfTurnId:session.turns.length,evidenceTurnIds:[turn.turnId],provider:turn.assessment.provider,model:turn.assessment.model,strategy:session.strategy,participantId:session.participantId};
  }
  if(!d.CONCEPTS.some(c=>c.id===body.conceptId) || !['verified','developing','needs_work','unknown'].includes(body.status))throw fail('知识点或掌握标签无效');
  const last=session.turns.filter(t=>t.task.conceptId===body.conceptId).at(-1);
  const phase=last?.task.phase || 'diagnostic';
  const label={conceptId:body.conceptId,status:body.status,annotator:body.annotator.trim(),phase,labeledAt:now(),blind:body.blind===true};
  if(body.note && (typeof body.note!=='string' || body.note.length>1000))throw fail('标注说明过长');
  label.note=body.note || '';
  session.humanMastery ||= {};session.humanMastery[`${body.conceptId}:${phase}`]=label;
  const evidence=session.turns.filter(t=>t.task.conceptId===body.conceptId && t.task.phase===phase);
  const providers=[...new Set(evidence.map(t=>t.assessment.provider))],models=[...new Set(evidence.map(t=>t.assessment.model))];
  return {event:'mastery_annotation',humanLabel:label,modelStatus:d.conceptSummary(session,body.conceptId).status,asOfTurnId:session.turns.length,evidenceTurnIds:evidence.map(t=>t.turnId),provider:providers.length===1?providers[0]:'mixed',model:models.length===1?models[0]:'mixed',strategy:session.strategy,participantId:session.participantId};
}
function exportRows(rows){
  let previousExportHash=null;
  return rows.map(({projection,hash,previousHash,...record})=>{
    const value={...record,sourceHash:hash || null,previousExportHash};
    const exportHash=digest(value);previousExportHash=exportHash;return {...value,exportHash};
  });
}
async function handleDialogue(req,res,pathname){
  try{
    if(pathname==='/api/dialogue/sessions' && req.method==='POST'){
      const body=await parseBody(req);
      if(body.strategy!==undefined && !['adaptive','fixed'].includes(body.strategy))throw fail('诊断策略无效');
      const session={id:randomUUID(),domainVersion:curriculum.VERSION,topic:'过拟合与泛化',participantId:anonymousId(body.participantId),strategy:body.strategy || 'adaptive',createdAt:now(),phase:'diagnostic',currentTaskId:curriculum.TASKS.find(t=>t.phase==='diagnostic' && t.kind==='explain').id,turns:[],lessons:{},supports:{},diagnosis:null,revision:0,budget:{modelCalls:0,reservedTokens:0,reportedTokens:0},trace:[],requests:{},run:null,retention:null};
      await withLock(session.id,()=>save(session,{event:'session_created',topic:session.topic,strategy:session.strategy,participantId:session.participantId,question:curriculum.publicTask(curriculum.taskById(session.currentTaskId))}));
      return send(res,201,view(session));
    }
    const match=pathname.match(/^\/api\/dialogue\/sessions\/([^/]+)(?:\/(answer|teach|posttest|delayed|hint|review|export|annotations|mastery-annotations))?$/);
    if(!match)throw fail('接口不存在',404);
    const [,id,action]=match;
    if(req.method==='GET' && (!action || ['export','review'].includes(action))){
      const rows=await readRows(id),session=rows.at(-1).projection;
      session.revision ||= rows.length;
      if(action==='review'){
        if(session.phase!=='diagnosed')throw fail('请完成当前阶段后再独立标注',409);
        return send(res,200,blindView(session));
      }
      if(action==='export'){
        res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Content-Disposition':`attachment; filename="masterymap-${id}.jsonl"`,'Cache-Control':'no-store'});
        return res.end(exportRows(rows).map(r=>JSON.stringify(r)).join('\n')+'\n');
      }
      return send(res,200,view(session));
    }
    if(req.method!=='POST' || !action || ['review','export'].includes(action))throw fail('请求方法不支持',405);
    const body=await parseBody(req);
    const result=await withLock(id,async()=>{
      const rows=await readRows(id),session=rows.at(-1).projection;
      if(['annotations','mastery-annotations'].includes(action)){
        await save(session,annotate(session,action,body));
        // Blind submissions return only acknowledgement, never an auto-label.
        if(body.blind===true)return {saved:true,sessionId:id,turnId:body.turnId || null,conceptId:body.conceptId || null};
        return view(session);
      }
      if(domain(session)===legacy)throw fail('这是旧版会话，可查看或导出；请新建五能力诊断',409,'LEGACY_SESSION');
      if(action!=='answer' && session.run && session.run.status!=='completed' && session.run.taskId===session.currentTaskId)throw fail('上一份回答尚未完成，请保持原回答重试',409,'PENDING_RUN');
      if(action==='answer')await answer(session,body);
      else if(action==='hint'){
        const task=curriculum.taskById(session.currentTaskId);
        if(session.phase!=='diagnostic' || !task || task.id!==body.taskId)throw fail('独立复测不提供解题提示，请完成当前任务',409);
        if(![1,2,3].includes(body.level))throw fail('提示等级无效');
        const hint=curriculum.selectHint(task,body.level);
        if(!hint)throw fail('本任务没有该等级提示');
        const previous=session.supports[task.id] || {level:0,answerSeen:false,hints:[]};
        if(!previous.hints.some(h=>h.level===body.level))previous.hints.push({...hint,providedAt:now()});
        previous.level=Math.max(previous.level,body.level);previous.answerSeen ||= hint.answerSeen===true;session.supports[task.id]=previous;
        trace(session,'help_provided',{taskId:task.id,level:body.level});await save(session,{event:'help_provided',taskId:task.id,support:previous});
      }else if(action==='teach'){
        if(session.phase!=='diagnosed')throw fail('请先完成当前诊断或复测',409);
        if(session.retention?.startedAt)throw fail('本次延时检查已开始，新的补学请新建会话',409);
        if(!curriculum.CONCEPTS.some(c=>c.id===body.conceptId))throw fail('知识点无效');
        if(session.lessons[body.conceptId])throw fail('该知识点本轮已经学习和复测',409);
        const lesson=curriculum.createLesson(session,body.conceptId);session.lessons[body.conceptId]={...lesson,startedAt:now()};session.activeConcept=body.conceptId;session.phase='learning';
        trace(session,'lesson_started',{conceptId:body.conceptId});await save(session,{event:'lesson_started',lesson:session.lessons[body.conceptId]});
      }else if(action==='posttest'){
        if(session.phase!=='learning')throw fail('请先阅读当前知识点讲解',409);
        session.phase='posttest';session.currentTaskId=curriculum.TASKS.find(t=>t.phase==='posttest' && t.conceptId===session.activeConcept).id;
        await save(session,{event:'posttest_started',conceptId:session.activeConcept,question:curriculum.publicTask(curriculum.taskById(session.currentTaskId))});
      }else if(action==='delayed'){
        if(session.phase!=='diagnosed' || !retention(session).available)throw fail('延时检查尚未到期或已经完成',409,'RETENTION_NOT_DUE');
        session.retention.startedAt=now();
        session.phase='delayed';session.currentTaskId=curriculum.TASKS.find(t=>t.phase==='delayed' && session.lessons[t.conceptId]).id;
        await save(session,{event:'delayed_started',question:curriculum.publicTask(curriculum.taskById(session.currentTaskId))});
      }
      return view(session);
    });
    return send(res,200,result);
  }catch(e){
    send(res,e.status || (e.name==='TimeoutError'?504:500),{error:e.status?e.message:e.name==='TimeoutError'?'模型调用超时，原回答与检查点已保留':'本轮暂时无法完成，请重试或导出已有记录',code:e.code || 'REQUEST_FAILED'});
  }
}
module.exports={handleDialogue,validateAssessment,view,readRows,blindView,exportRows};
