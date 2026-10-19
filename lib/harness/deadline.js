const {fail}=require('./schema');
function assertActive(signal){if(signal?.aborted)throw fail('本轮运行已超时，检查点已保留',504,'RUN_TIMEOUT');}
async function bounded(work,parent,milliseconds){
  assertActive(parent);
  const controller=new AbortController();
  let timer,onAbort;
  const timeout=new Promise((_,reject)=>{
    const stop=()=>{const error=fail('模型或工具超过本轮截止时间',504,'RUN_TIMEOUT');controller.abort(error);reject(error);};
    onAbort=stop;parent?.addEventListener('abort',onAbort,{once:true});
    timer=setTimeout(stop,Math.max(1,milliseconds));
  });
  try{return await Promise.race([Promise.resolve().then(()=>work(controller.signal)),timeout]);}
  finally{clearTimeout(timer);parent?.removeEventListener('abort',onAbort);}
}
module.exports={bounded,assertActive};
