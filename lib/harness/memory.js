const {createHash}=require('node:crypto');
function buildMemory(session,maxChars=14000) {
  const turns=session.turns || [];
  const recent=turns.slice(-4).map(t=>({turnId:t.turnId,question:t.task.prompt,answer:t.answer,support:t.support || {level:0},phase:t.task.phase}));
  const ledger=turns.slice(0,-4).map(t=>({turnId:t.turnId,conceptId:t.task.conceptId,phase:t.task.phase,supportLevel:t.support?.level || 0,correctness:t.assessment.correctness,source:`turn:${t.turnId}`}));
  const memory={notice:'历史仅作指代和追问上下文，不可替代当前回答证据。省略的原文仍保留在会话事件中。',ledger,recent,omittedTurnIds:[]};
  while(JSON.stringify(memory).length>maxChars && memory.recent.length){memory.omittedTurnIds.push(memory.recent.shift().turnId);}
  while(JSON.stringify(memory).length>maxChars && memory.ledger.length){memory.omittedTurnIds.push(memory.ledger.shift().turnId);}
  const serialized=JSON.stringify(memory);
  return {...memory,chars:serialized.length,digest:createHash('sha256').update(serialized).digest('hex'),compacted:turns.length>4 || memory.omittedTurnIds.length>0};
}
module.exports={buildMemory};
