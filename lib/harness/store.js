const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {config}=require('./config');
const {fail}=require('./schema');
const {assertActive}=require('./deadline');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function filename(id){if(!uuid.test(id))throw fail('会话编号无效');return path.join(config().dataDir,`${id}.jsonl`);}
function digest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
async function readRows(id){
  let content;
  try{content=await fs.readFile(filename(id),'utf8');}catch(e){if(e.code==='ENOENT')throw fail('会话不存在',404);throw e;}
  let rows;
  try{rows=content.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch{throw fail('会话日志不完整，已停止写入以保留证据',500,'CORRUPT_LOG');}
  let previous=null;
  let hashed=false;
  for(let i=0;i<rows.length;i++){
    const {hash,...value}=rows[i];
    const needsProof=hashed || 'hash' in rows[i] || 'seq' in rows[i] || 'previousHash' in rows[i] || rows[i].schemaVersion>=2 || /^overfitting-v2/.test(rows[i].domainVersion || rows[i].projection?.domainVersion || '');
    if(needsProof && (rows[i].schemaVersion!==2 || rows[i].seq!==i+1 || rows[i].previousHash!==previous || hash!==digest(value)))throw fail('会话日志校验失败',500,'CORRUPT_LOG');
    hashed ||= needsProof;
    previous=hash || null;
  }
  if(!rows.length || !rows.at(-1).projection)throw fail('会话没有可恢复快照',500,'CORRUPT_LOG');
  return rows;
}
async function save(session,record,{signal}={}){
  assertActive(signal);
  const file=filename(session.id);await fs.mkdir(config().dataDir,{recursive:true,mode:0o700});
  let rows=[];
  try{rows=await readRows(session.id);}catch(e){if(e.status!==404)throw e;}
  if((session.revision || 0)!==rows.length)throw fail('会话版本已改变，请刷新',409,'REVISION_CONFLICT');
  session.revision=rows.length+1;
  const value={schemaVersion:2,seq:session.revision,sessionId:session.id,domainVersion:session.domainVersion,timestamp:new Date().toISOString(),previousHash:rows.at(-1)?.hash || null,...record,projection:structuredClone(session)};
  const row={...value,hash:digest(value)};
  const temporary=`${file}.${randomUUID()}.tmp`;
  const handle=await fs.open(temporary,'wx',0o600);
  try{
    await handle.writeFile([...rows,row].map(r=>JSON.stringify(r)).join('\n')+'\n');await handle.sync();await handle.close();
    assertActive(signal);await fs.rename(temporary,file);
  }catch(e){await handle.close().catch(()=>{});await fs.unlink(temporary).catch(()=>{});session.revision--;throw e;}
  return row;
}
async function withLock(id,fn){
  const file=filename(id),lock=`${file}.lock`;
  await fs.mkdir(config().dataDir,{recursive:true,mode:0o700});
  let acquired=false;
  for(let attempt=0;attempt<1;attempt++){
    try{const handle=await fs.open(lock,'wx',0o600);await handle.writeFile(JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()}));await handle.close();acquired=true;break;}
    catch(e){
      if(e.code!=='EEXIST')throw e;
      let owner;try{owner=JSON.parse(await fs.readFile(lock,'utf8'));}catch{throw fail('会话锁待恢复，请稍后重试',409,'SESSION_LOCKED');}
      if(!Number.isInteger(owner.pid) || owner.pid<=0)throw fail('会话锁无效，请检查本机日志',409,'SESSION_LOCKED');
      let alive=true;try{process.kill(owner.pid,0);}catch(err){if(err.code==='ESRCH')alive=false;}
      if(alive)throw fail('上一轮仍在处理，请稍后刷新',409,'SESSION_LOCKED');
      throw fail('会话保留了中断锁；停止服务后运行 npm run recover -- --offline 再重试',409,'RECOVERY_REQUIRED');
    }
  }
  if(!acquired)throw fail('会话正在恢复，请重试',409,'SESSION_LOCKED');
  try{return await fn();}finally{await fs.unlink(lock).catch(()=>{});}
}
module.exports={readRows,save,withLock,digest};
