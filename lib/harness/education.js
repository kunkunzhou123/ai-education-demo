const {runAgent,tool}=require('./runner');
const {loadSkill}=require('./skills');
const {buildMemory}=require('./memory');
const {validateAssessment,objectArgs,fail}=require('./schema');
const {config}=require('./config');
const arrays={type:'array',items:{type:'string'},maxItems:8};
function skillTool(role){return tool('load_skill','按需阅读当前角色允许的教学规范',{name:{type:'string'}},['name'],async args=>{objectArgs(args,['name']);return loadSkill(role,args.name);});}

async function evaluate({session,task,answer,support,onEvent,checkpoint,signal,curriculum}){
  const cfg=config(),skill=await loadSkill('evaluator','evidence-assessment');
  const memory=buildMemory(session,Math.max(2000,cfg.maxContextChars-7000));
  await onEvent(memory.compacted?'context_compacted':'memory_loaded',{role:'evaluator',chars:memory.chars,digest:memory.digest,omittedTurnIds:memory.omittedTurnIds,skillDigest:skill.digest});
  if(!cfg.key){
    const raw=curriculum.offlineAssess(task,answer);
    const value={...raw,skillDigest:skill.digest,contextDigest:memory.digest};
    session.run.toolCalls++;await onEvent('after_tool',{role:'evaluator',tool:'record_assessment',summary:'离线规则演示，未调用大模型'});await checkpoint(value);return value;
  }
  const concept=curriculum.CONCEPTS.find(c=>c.id===task.conceptId);
  return runAgent({role:'evaluator',model:cfg.evaluatorModel,cfg,session,signal,onEvent,checkpoint,
    system:`你是学习证据评估员。${skill.text}\n必须使用 record_assessment 提交结构化判断。不能调用未列出的工具；不要输出思维链。`,
    input:{task:{...task,criteria:task.criteria.map(c=>c.label),misconceptions:task.misconceptions.map(c=>c.label)},rubric:concept?.rubric,answer,support,memory},
    tools:[skillTool('evaluator'),tool('record_assessment','记录当前学生回答的评估，不能设置掌握概率',{
      correctness:{type:'string',enum:['correct','partial','wrong','insufficient']},evidenceQuotes:arrays,demonstrated:arrays,missing:arrays,misconceptions:arrays,rationale:{type:'string'}
    },['correctness','evidenceQuotes','demonstrated','missing','misconceptions','rationale'],async args=>{
      objectArgs(args,['correctness','evidenceQuotes','demonstrated','missing','misconceptions','rationale']);
      const assessment=validateAssessment(args,answer);
      return {terminal:true,value:{...assessment,provider:cfg.provider,model:cfg.evaluatorModel,promptVersion:curriculum.VERSION,skillDigest:skill.digest,contextDigest:memory.digest}};
    })]
  });
}
async function plan({session,lastTask,assessment,onEvent,checkpoint,signal,curriculum}){
  const cfg=config(),fallback=curriculum.nextDiagnostic(session,lastTask,assessment);
  if(!fallback){await checkpoint(null);return null;}
  const candidates=curriculum.eligibleDiagnostic ? curriculum.eligibleDiagnostic(session) : [fallback];
  const eligible=candidates.length?candidates:[fallback];
  if(!cfg.key || session.strategy==='fixed'){
    session.run.toolCalls++;await onEvent('after_tool',{role:'planner',tool:'choose_question',summary:session.strategy==='fixed'?'固定顺序基线':'依据缺失证据选择审核题库任务'});await checkpoint(fallback.id);return fallback.id;
  }
  const skill=await loadSkill('planner','adaptive-questioning');
  return runAgent({role:'planner',model:cfg.plannerModel,cfg,session,signal,onEvent,checkpoint,
    system:`你是诊断提问规划员。${skill.text}\n必须调用 choose_question。从候选中选一项，解释选择理由，不给学生提供答案。`,
    input:{skillDigest:skill.digest,lastTask:curriculum.publicTask(lastTask),assessment,candidates:eligible.map(curriculum.publicTask),recommendation:fallback.id,coverage:curriculum.CONCEPTS.map(c=>curriculum.conceptSummary(session,c.id)),remainingTurns:10-session.turns.filter(t=>t.task.phase==='diagnostic').length},
    tools:[skillTool('planner'),tool('choose_question','选择服务端允许的下一个诊断问题',{taskId:{type:'string',enum:eligible.map(t=>t.id)},reason:{type:'string'}},['taskId','reason'],async args=>{
      objectArgs(args,['taskId','reason']);
      if(!eligible.some(t=>t.id===args.taskId) || typeof args.reason!=='string' || !args.reason.trim() || args.reason.length>500)throw fail('规划动作不在候选范围内',502,'INVALID_QUESTION');
      return {terminal:true,value:args.taskId,summary:args.reason};
    })]
  });
}
module.exports={evaluate,plan};
