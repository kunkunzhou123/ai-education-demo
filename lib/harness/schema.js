const fail=(message,status=400,code='INVALID_INPUT')=>Object.assign(new Error(message),{status,code});
const correctness=['correct','partial','wrong','insufficient'];
function validateAssessment(raw,answer) {
  if(!raw || !correctness.includes(raw.correctness))throw fail('评估结果格式无效',502,'INVALID_ASSESSMENT');
  for(const key of ['evidenceQuotes','demonstrated','missing','misconceptions']){
    if(!Array.isArray(raw[key]) || raw[key].length>8 || raw[key].some(s=>typeof s!=='string' || !s.trim() || s.length>600))throw fail('评估依据格式无效',502,'INVALID_ASSESSMENT');
  }
  if(typeof raw.rationale!=='string' || !raw.rationale.trim() || raw.rationale.length>1500)throw fail('评估解释无效',502,'INVALID_ASSESSMENT');
  if(raw.evidenceQuotes.some(q=>!answer.includes(q)))throw fail('评估引用并非学生原话',502,'INVALID_ASSESSMENT');
  if(raw.correctness!=='insufficient' && !raw.evidenceQuotes.length)throw fail('评估缺少学生原话证据',502,'INVALID_ASSESSMENT');
  if(raw.correctness==='correct' && (raw.missing.length || raw.misconceptions.length || !raw.demonstrated.length))throw fail('评估判分与依据矛盾',502,'INVALID_ASSESSMENT');
  return Object.fromEntries(['correctness','evidenceQuotes','demonstrated','missing','misconceptions','rationale'].map(k=>[k,raw[k]]));
}
function objectArgs(value,keys) {
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!keys.includes(k)))throw fail('工具参数含未授权字段',502,'INVALID_TOOL_ARGS');
  return value;
}
module.exports={fail,correctness,validateAssessment,objectArgs};
