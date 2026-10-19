// Operator-only recovery. It never changes dialogue evidence or model outcomes.
const fs=require('node:fs/promises');
const path=require('node:path');
const {config}=require('../lib/harness/config');
async function main(){
  if(!process.argv.includes('--offline'))throw new Error('请先停止所有使用本数据目录的服务，再运行 npm run recover -- --offline');
  const dir=config().dataDir;
  const names=await fs.readdir(dir).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
  const recovered=[],active=[];
  for(const name of names){
    if(!/^[0-9a-f-]{36}\.jsonl\.lock$/.test(name))continue;
    const file=path.join(dir,name);
    const owner=JSON.parse(await fs.readFile(file,'utf8'));
    if(!Number.isInteger(owner.pid) || owner.pid<=0)throw new Error(`锁元数据无效：${name}`);
    let live=true;try{process.kill(owner.pid,0);}catch(e){if(e.code==='ESRCH')live=false;else throw e;}
    if(live){active.push(name);continue;}
    await fs.unlink(file);recovered.push(name);
  }
  console.log(JSON.stringify({recovered,active,note:'仅清理停止进程留下的锁文件。原始日志未变更；重新启动后，使用原提交编号恢复检查点。'},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
