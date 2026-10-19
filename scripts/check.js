const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(path.join(dir,item.name)):item.name.endsWith('.js')?[path.join(dir,item.name)]:[]);}
const targets=['server.js',...['lib','public','scripts','test'].flatMap(files)];
for(const target of targets){const result=spawnSync(process.execPath,['--check',target],{encoding:'utf8'});if(result.status!==0){process.stderr.write(result.stderr);process.exit(result.status || 1);}}
console.log(`Syntax checked ${targets.length} JavaScript files`);
