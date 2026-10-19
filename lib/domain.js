const VERSION = 'overfitting-v1';
const CONCEPTS = [
  { id: 'identify', label: '识别泛化问题', objective: '结合训练表现和未见数据表现，区分过拟合与欠拟合。',
    sections: [
      ['先比较两种表现', '训练表现描述模型对已见样本的拟合；验证或测试表现描述它对未见样本的泛化。训练很好、未见数据明显较差，是过拟合的证据。两边都差通常更像欠拟合。'],
      ['单个数字不能完成诊断', '只知道训练准确率 99%，无法判断过拟合。还需独立验证集表现，并检查数据划分、分布变化和指标是否合理。'],
      ['看变化趋势', '训练误差下降而验证误差上升，说明继续优化训练目标没有改善泛化。应依据验证集选择训练轮数，保留独立测试集做最终评估。']
    ], example: '训练准确率 99%、验证准确率 70%：存在明显泛化差距。若两者均为 60%，应先检查模型能力、特征和数据质量，不能仅因分数低就称为过拟合。' },
  { id: 'cause', label: '解释过拟合原因', objective: '解释复杂模型、有限数据与噪声之间的关系。',
    sections: [
      ['拟合规律与记住偶然细节', '复杂模型可以表达规律，也可以把训练数据中的噪声和偶然细节记下来。这些细节在新样本中未必出现。'],
      ['复杂度需要结合数据量', '一棵无限制的深决策树能把少量训练样本分得很细，但这种划分可能不稳定。增加有代表性的数据、限制树深度，可以减少对偶然样本的依赖。'],
      ['训练变好不代表学得更好', '训练损失下降只说明对当前训练目标优化得更好。是否学到可泛化的规律，需要独立验证；重复复制同一批样本不会增加新的信息。']
    ], example: '用 20 个样本训练深树，树可能依据某个样本独有的特征分支。换一批样本后，这条规则失效。浅树可能训练分数略低，却在新数据上更稳定。' },
  { id: 'intervention', label: '选择改进方法', objective: '根据验证证据选择正则化、复杂度控制或早停，并避免测试泄漏。',
    sections: [
      ['让改进对准问题', '过拟合时可尝试减小模型复杂度、正则化、增加有代表性的数据；对迭代模型可使用早停。方法需要在验证集上比较，不能保证一次调整必然有效。'],
      ['早停依据验证表现', '训练误差继续下降、验证误差开始上升时，可以保留验证误差最低的训练检查点。盲目增加轮数通常会继续拟合训练细节。'],
      ['区分验证集与测试集', '验证集用于选择模型和超参数。独立测试集用于最终评估；反复看测试结果来调参会使其失去独立性，得到过于乐观的估计。']
    ], example: '验证误差在第 8 轮最低，随后上升：可以选择第 8 轮检查点，并比较适当正则化。选择完成后，才在未参与选择的测试集上做最终评估。' }
];

function task(id, conceptId, kind, prompt, criteria, misconceptions, phase = 'diagnostic') {
  return { id, conceptId, kind, prompt, criteria, misconceptions, phase, hintLevel: 0 };
}
const TASKS = [
  task('identify-explain', 'identify', 'explain', '某分类模型训练准确率 99%，验证准确率 70%。你会如何判断？请解释依据，并说说还需要检查什么。',
    [{label:'识别过拟合或泛化差距', pattern:'过拟合|泛化.{0,8}(差|不好)|差距'}, {label:'比较训练与验证表现',pattern:'(训练|99).*(验证|测试|70)|(验证|测试|70).*(训练|99)'}], []),
  task('identify-transfer', 'identify', 'transfer', '另一模型训练准确率 60%，验证准确率 59%。这与上一种情况相同吗？你倾向于什么判断，为什么？',
    [{label:'识别欠拟合或高偏差',pattern:'欠拟合|高偏差|表达.{0,6}(不足|不够)'},{label:'说明训练与验证均差或差距小',pattern:'(都|均|两者|两边).{0,8}(低|差|不好)|差距.{0,6}(小|不大)|接近'}], [{pattern:'^(这是|属于|是)?过拟合[。！!\s]*$',label:'把两边都差误判为过拟合'}]),
  task('identify-probe', 'identify', 'explain', '如果只告诉你训练准确率是 99%，还没有验证结果，你能确定它过拟合吗？说明缺少什么证据。',
    [{label:'指出不能确定',pattern:'不能|无法|不一定|不足以|不够|还不能'},{label:'需要独立验证表现',pattern:'验证|测试|未见|新数据'}], []),
  task('cause-explain', 'cause', 'explain', '为什么一棵很深的决策树，在只有 20 个训练样本时，可能训练很好却在新样本上表现差？请解释发生了什么。',
    [{label:'模型记住噪声或偶然细节',pattern:'噪声|记住|记忆|偶然|细节'},{label:'复杂度与有限样本不匹配',pattern:'复杂|深|样本.{0,5}(少|小)|数据.{0,5}(少|小)|20'}], []),
  task('cause-transfer', 'cause', 'transfer', '把这 20 个训练样本各复制 100 次，是否就能解决过拟合？请解释复制数据与获得新样本的区别。',
    [{label:'指出复制不能解决',pattern:'不能|不会|无法|不一定|不能保证|没有解决|不等于'},{label:'没有新增信息或多样性',pattern:'信息|多样|相同|重复|代表性|新样本|新数据'}], []),
  task('cause-probe', 'cause', 'explain', '模型记住训练样本中的偶然细节，为什么这些细节在新样本上可能失效？请结合噪声或数据量解释。',
    [{label:'噪声或偶然规律无法泛化',pattern:'噪声|偶然|不稳定|不代表'},{label:'连接到未见数据',pattern:'新样本|新数据|未见|泛化|不同'}], []),
  task('intervention-explain', 'intervention', 'explain', '训练误差持续下降，验证误差在第 8 轮后持续上升。你会怎样调整？为什么？',
    [{label:'选择早停或复杂度控制',pattern:'早停|停止|第.?8轮|正则|降低.{0,5}复杂|减小.{0,5}复杂'},{label:'依据验证表现而非训练表现',pattern:'验证|泛化|过拟合'}], [{pattern:'(应该|只需|需要|继续|通过).{0,5}(增加|加大).{0,5}(轮数|训练次数)|继续训练就',label:'认为增加训练轮数必然改善泛化'}]),
  task('intervention-transfer', 'intervention', 'transfer', '你试了十组正则化参数。能否反复根据测试集分数选择参数，再把最高测试分数作为最终性能？你会如何安排数据使用？',
    [{label:'用验证集调参',pattern:'验证集.{0,10}(选|调|比较)|(选|调).{0,10}验证集'},{label:'测试集保持独立',pattern:'独立|未参与|最后|最终.{0,8}(一次|评估)|泄漏|乐观|偏高'}], []),
  task('intervention-probe', 'intervention', 'explain', '如果继续训练只让训练误差变小，而验证误差变大，你会保留哪一轮模型？选择依据是什么？',
    [{label:'保留验证表现最好的检查点',pattern:'验证.{0,10}(最低|最小|最好)|最低.{0,8}验证'},{label:'说明泛化目标',pattern:'泛化|新数据|未见|过拟合|验证'}], []),
  task('identify-post-explain', 'identify', 'explain', '复测：模型 A 的训练/验证准确率为 98%/68%，模型 B 为 62%/61%。分别更像什么问题？说明两者判断依据。',
    [{label:'区分过拟合与欠拟合',pattern:'过拟合.*欠拟合|欠拟合.*过拟合'},{label:'解释泛化差距与双低表现',pattern:'差距|都.{0,5}(低|差)|均.{0,5}(低|差)|接近'}], [], 'posttest'),
  task('identify-post-transfer', 'identify', 'transfer', '复测：训练准确率 95%，测试准确率也为 95%。只根据这两个数，你能断言发生了过拟合吗？如果部署表现变差，还需要检查什么？',
    [{label:'不凭高训练分断言过拟合',pattern:'不能|无法|不一定|不足'},{label:'指出分布、划分或独立性检查',pattern:'分布|泄漏|独立|划分|代表性|数据变化'}], [], 'posttest'),
  task('cause-post-explain', 'cause', 'explain', '复测：一个高复杂度模型把少量样本中的随机标签也拟合得很好。这是否说明它学到了可靠规律？为什么？',
    [{label:'识别记忆噪声而非可靠规律',pattern:'噪声|记住|记忆|随机|偶然'},{label:'说明不能保证泛化',pattern:'泛化|新数据|新样本|未见|不可靠'}], [], 'posttest'),
  task('cause-post-transfer', 'cause', 'transfer', '复测：在模型和训练流程相同时，新增一批有代表性且独立的样本，与把旧样本重复十遍，哪种更可能帮助泛化？说明原因。',
    [{label:'选择新的代表性样本',pattern:'新增|新样本|新数据|独立.{0,5}样本|前者'},{label:'指出信息、多样性或减少偶然性',pattern:'信息|多样|偶然|噪声|重复'}], [], 'posttest'),
  task('intervention-post-explain', 'intervention', 'explain', '复测：验证损失第 12 轮最低，第 20 轮训练损失更低但验证损失更高。你选择哪轮模型？再给出一种可尝试的改进方法并解释。',
    [{label:'依据验证选第12轮',pattern:'12|十二'},{label:'选择正则化或复杂度控制',pattern:'正则|复杂度|新样本|新数据|数据增|早停'}], [], 'posttest'),
  task('intervention-post-transfer', 'intervention', 'transfer', '复测：同事每次看测试集结果后修改树深度，最后报告最好的测试分数。这个评估有什么问题？你如何改进？',
    [{label:'识别测试参与选择导致偏差',pattern:'泄漏|乐观|偏高|不独立|参与.{0,5}(选|调)|过拟合.{0,5}测试'},{label:'验证调参与独立测试分开',pattern:'验证|新的测试|独立测试|未参与'}], [], 'posttest')
];
const taskById = id => TASKS.find(t => t.id === id);
const publicTask = t => t ? { id: t.id, conceptId: t.conceptId, kind: t.kind, prompt: t.prompt, phase: t.phase, hintLevel: t.hintLevel } : null;

function conceptSummary(session, id) {
  const turns = session.turns.filter(t => t.task.conceptId === id);
  const scored = turns.filter(t => t.assessment.correctness !== 'insufficient');
  const score = scored.length ? Math.round(scored.reduce((s,t) => s + ({correct:1,partial:.5,wrong:0}[t.assessment.correctness]) * (t.task.phase === 'posttest' ? 2 : 1), 0) / scored.reduce((s,t) => s + (t.task.phase === 'posttest' ? 2 : 1), 0) * 100) : null;
  const latest = kind => turns.filter(t => t.task.kind === kind).at(-1);
  const explain = latest('explain'), transfer = latest('transfer');
  const verified = [explain, transfer].every(t => t && t.assessment.correctness === 'correct' && t.task.hintLevel === 0);
  const status = verified ? 'verified' : !scored.length ? 'unknown' : turns.some(t => ['correct','partial'].includes(t.assessment.correctness)) ? 'developing' : 'needs_work';
  return { conceptId:id, status, score, evidenceCount:turns.length, reliability: !turns.length ? '尚无证据' : verified ? '解释与迁移均已验证' : turns.length < 2 ? '证据有限，需继续验证' : '证据存在缺口', misconceptions:[...new Set(turns.flatMap(t => t.assessment.misconceptions))] };
}

function nextDiagnostic(session, lastTask, assessment) {
  const turns = session.turns.filter(t => t.task.phase === 'diagnostic');
  if (turns.length >= 10) return null;
  const done = new Set(turns.map(t => t.task.id));
  if (lastTask && assessment.correctness !== 'correct') {
    const probe = TASKS.find(t => t.id === `${lastTask.conceptId}-probe`);
    if (!done.has(probe.id)) return probe;
  }
  const base = TASKS.find(t => t.phase === 'diagnostic' && !t.id.endsWith('-probe') && !done.has(t.id));
  if (base) return base;
  return TASKS.find(t => t.phase === 'diagnostic' && !done.has(t.id) && conceptSummary(session,t.conceptId).status !== 'verified') || null;
}

function offlineAssess(task, answer) {
  const text = answer.replace(/\s+/g,'');
  const hits = task.criteria.filter(c => new RegExp(c.pattern,'i').test(text));
  const mistakes = task.misconceptions.filter(m => new RegExp(m.pattern,'i').test(text)).map(m => m.label);
  const uncertain = /^(我)?(不知道|不清楚|不懂|不会|随便)([。.!！?？]|$)|不知道(怎么|如何)|不会(做|解|回答)/.test(text);
  const correctness = uncertain || text.length < 8 ? 'insufficient' : mistakes.length ? 'wrong' : hits.length === task.criteria.length ? 'correct' : hits.length ? 'partial' : 'insufficient';
  return { correctness, evidenceQuotes: correctness === 'insufficient' ? [] : [answer.slice(0,240)], demonstrated: hits.map(c => c.label), missing: task.criteria.filter(c => !hits.includes(c)).map(c => c.label), misconceptions: mistakes, rationale: '离线关键词规则仅用于体验交互；可能误判否定、反讽或复述，需人工复核。', provider:'offline-rules', model:null, promptVersion:VERSION };
}

module.exports = { VERSION, CONCEPTS, TASKS, taskById, publicTask, conceptSummary, nextDiagnostic, offlineAssess };
