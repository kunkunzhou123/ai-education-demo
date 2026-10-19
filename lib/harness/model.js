const {fail}=require('./schema');
async function complete({cfg,model,messages,tools,signal}){
  const response=await fetch(cfg.endpoint,{
    method:'POST',redirect:'error',signal,
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${cfg.key}`},
    body:JSON.stringify({model,temperature:0,max_tokens:cfg.maxOutputTokens,messages,tools,tool_choice:'required',parallel_tool_calls:false})
  });
  if(!response.ok)throw fail(`模型服务返回 ${response.status}，已保留运行检查点`,502,'MODEL_UNAVAILABLE');
  const data=await response.json();
  const message=data.choices?.[0]?.message;
  if(!message || !Array.isArray(message.tool_calls) || !message.tool_calls.length)throw fail('模型未调用允许的工具，已停止本轮',502,'INVALID_MODEL_RESPONSE');
  if(message.tool_calls.length!==1)throw fail('每一步只允许一个工具动作',502,'INVALID_TOOL_CALL');
  return {message:{role:'assistant',content:null,tool_calls:message.tool_calls},usage:data.usage || null};
}
module.exports={complete};
