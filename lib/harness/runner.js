const {complete}=require('./model');
const {fail}=require('./schema');
const {bounded,assertActive}=require('./deadline');
const traceLabels={before_model:'评估当前证据',after_model:'收到结构化决策',before_tool:'执行允许的动作',after_tool:'动作已验证',context_compacted:'整理历史上下文',checkpoint:'保存运行检查点',paused:'等待学生回答'};
function tool(name,description,properties,required,execute){return {definition:{type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}},execute};}
async function runAgent({role,model,system,input,tools,cfg,session,checkpoint,onEvent,signal}){
  const messages=[{role:'system',content:system},{role:'user',content:JSON.stringify(input)}];
  const registry=new Map(tools.map(t=>[t.definition.function.name,t]));
  for(let step=0;step<cfg.maxSteps;step++){
    if(signal.aborted)throw fail('本轮运行已超时，可从检查点重试',504,'RUN_TIMEOUT');
    const run=session.run;
    if(run.modelCalls>=cfg.maxModelCalls)throw fail('本轮模型调用已达到上限，请查看已保留证据',429,'MODEL_BUDGET_EXCEEDED');
    const chars=JSON.stringify(messages).length+JSON.stringify(tools.map(t=>t.definition)).length;
    if(chars>cfg.maxContextChars)throw fail('当前上下文超过限制',413,'CONTEXT_LIMIT');
    const reserved=Math.ceil(Buffer.byteLength(JSON.stringify({messages,tools:tools.map(t=>t.definition)}),'utf8')/2)+cfg.maxOutputTokens;
    if((session.budget.reservedTokens || 0)+reserved>cfg.maxSessionTokens)throw fail('会话估算用量预算不足，请导出当前记录',429,'TOKEN_BUDGET_EXCEEDED');
    session.budget.reservedTokens+=reserved;session.budget.modelCalls++;run.modelCalls++;
    await onEvent('before_model',{role,step,reservedTokens:reserved});
    const result=await bounded(callSignal=>complete({cfg,model,messages,tools:tools.map(t=>t.definition),signal:callSignal}),signal,Math.min(cfg.modelTimeoutMs,Math.max(1,run.deadline-Date.now())));
    assertActive(signal);
    if(result.usage && Number.isInteger(result.usage.total_tokens) && result.usage.total_tokens>=0){
      session.budget.reportedTokens+=result.usage.total_tokens;
      session.budget.reservedTokens+=result.usage.total_tokens-reserved;
    }else session.budget.estimatedTokens=(session.budget.estimatedTokens || 0)+reserved;
    await onEvent('after_model',{role,step,reportedTokens:result.usage?.total_tokens || null});
    messages.push(result.message);
    const ids=new Set();
    for(const call of result.message.tool_calls){
      if(!call.id || ids.has(call.id) || call.type!=='function' || typeof call.function?.name!=='string')throw fail('工具调用编号或类型无效',502,'INVALID_TOOL_CALL');
      ids.add(call.id);
      const handler=registry.get(call.function.name);
      if(!handler)throw fail('模型请求了当前角色未授权的工具',502,'TOOL_NOT_ALLOWED');
      if(++run.toolCalls>cfg.maxSteps*2)throw fail('本轮工具次数达到上限',429,'TOOL_BUDGET_EXCEEDED');
      let args;try{args=JSON.parse(call.function.arguments || '{}');}catch{throw fail('工具参数不是有效 JSON',502,'INVALID_TOOL_ARGS');}
      await onEvent('before_tool',{role,tool:call.function.name});
      assertActive(signal);
      const output=await bounded(toolSignal=>handler.execute(args,{signal:toolSignal}),signal,Math.max(1,run.deadline-Date.now()));
      assertActive(signal);
      await onEvent('after_tool',{role,tool:call.function.name,summary:output?.summary || '参数及结果已校验'});
      if(output?.terminal){assertActive(signal);await checkpoint(output.value);return output.value;}
      messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(output)});
    }
  }
  throw fail('智能体未在限定步骤内完成动作',429,'STEP_BUDGET_EXCEEDED');
}
module.exports={runAgent,tool,traceLabels};
