const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {fail}=require('./schema');
const roleSkills={evaluator:['evidence-assessment'],planner:['adaptive-questioning'],tutor:['guided-learning']};
async function loadSkill(role,name){
  if(!roleSkills[role]?.includes(name))throw fail('该角色不能加载此教学技能',502,'SKILL_NOT_ALLOWED');
  const text=await fs.readFile(path.join(__dirname,'../../education-skills',`${name}.md`),'utf8');
  return {name,text,digest:createHash('sha256').update(text).digest('hex')};
}
module.exports={loadSkill,roleSkills};
