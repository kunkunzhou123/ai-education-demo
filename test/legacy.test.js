const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
test('原地图单题不会被信心放大，根节点成功复测不因85%覆盖而降分',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
  const context=vm.createContext({state:{plan:{nodes:[{id:'root',parentId:null},{id:'child',parentId:'root'}]},attempts:[{nodeId:'root',correct:true,score:.65},{nodeId:'child',correct:false,score:.2}]},learning:{reviewAttempts:[]}});
  for(const [start,end] of [['function scoreAttempt(','function submitCurrent('],['function nodeScore(','function showResults(']]) vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),context);
  vm.runInContext('function children(id){return state.plan.nodes.filter(n=>n.parentId===id)}',context);
  assert.equal(vm.runInContext('scoreAttempt(true,4)',context),.65);
  const before=vm.runInContext('finalRootScore(state.plan.nodes[0])',context);
  context.learning.reviewAttempts.push({nodeId:'root',score:.85},{nodeId:'root',score:.85});
  assert.ok(vm.runInContext('finalRootScore(state.plan.nodes[0])',context)>before);
  assert.equal(context.state.attempts.length,2);
});
