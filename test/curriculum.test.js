'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CONCEPTS, TASKS, taskById, publicTask, conceptSummary, eligibleDiagnostic, nextDiagnostic,
  offlineAssess, createLesson, selectHint } = require('../lib/curriculum');

const turn = (id, correctness = 'correct', support, misconceptions = []) => ({
  task: taskById(id), answer: '测试回答', assessment: { correctness, evidenceQuotes: ['测试回答'],
    demonstrated: [], missing: [], misconceptions }, ...(support ? { support } : {})
});

test('五能力使用互不重复的三套任务，复测和延时均含完整解释与迁移', () => {
  assert.equal(CONCEPTS.length, 5);
  assert.equal(new Set(TASKS.map(item => item.id)).size, TASKS.length);
  assert.equal(TASKS.length, 35);
  for (const concept of CONCEPTS) {
    assert.ok(concept.rubric.full.length && concept.rubric.partial.length && concept.rubric.misconceptions.length);
    assert.ok(concept.prerequisites.every(id => CONCEPTS.some(item => item.id === id)));
    for (const phase of ['diagnostic', 'posttest', 'delayed']) {
      const items = TASKS.filter(item => item.conceptId === concept.id && item.phase === phase);
      assert.equal(items.length, phase === 'diagnostic' ? 3 : 2);
      assert.ok(items.some(item => item.kind === 'explain' && item.difficulty > 1));
      assert.ok(items.some(item => item.kind === 'transfer'));
      assert.equal(new Set(items.map(item => item.form)).size, 1);
    }
  }
  for (const item of TASKS) {
    assert.ok(item.criteria.length >= 2, item.id);
    for (const rule of [...item.criteria, ...item.misconceptions]) assert.doesNotThrow(() => new RegExp(rule.pattern, 'i'));
  }
});

test('对外题目不泄露评分标准、误解匹配或参考答案', () => {
  const task = { ...TASKS[0], answer: '参考答案', rubric: { full: '内部评分' } };
  const exposed = publicTask(task);
  assert.equal(exposed.criteria, undefined);
  assert.equal(exposed.misconceptions, undefined);
  assert.equal(exposed.answer, undefined);
  assert.equal(exposed.rubric, undefined);
  assert.equal(exposed.prompt, task.prompt);
  assert.equal(publicTask(null), null);
});

test('缺证据允许弃判，单次回答与短追问不等于完整掌握', () => {
  assert.equal(conceptSummary({ turns: [] }, 'gap').status, 'unknown');
  const unknown = conceptSummary({ turns: [turn('gap-explain', 'insufficient')] }, 'gap');
  assert.equal(unknown.status, 'unknown'); assert.equal(unknown.score, null);
  assert.equal(unknown.independentCount, 0);
  assert.equal(conceptSummary({ turns: [turn('gap-explain')] }, 'gap').status, 'developing');
  assert.notEqual(conceptSummary({ turns: [turn('gap-probe'), turn('gap-transfer')] }, 'gap').status, 'verified');
});

test('受助与看过答案的正确回答不得算独立验证，撤架新题可以重新提供证据', () => {
  for (const support of [{ level: 1, answerSeen: false }, { level: 0, answerSeen: true }, { level: 3, answerSeen: false }]) {
    const session = { turns: [turn('gap-explain'), turn('gap-transfer', 'correct', support)] };
    const summary = conceptSummary(session, 'gap');
    assert.notEqual(summary.status, 'verified'); assert.equal(summary.independentCount, 1);
    assert.match(summary.reliability, /受助|已见答案/);
  }
  const session = { turns: [turn('gap-explain', 'correct', { level: 1 }), turn('gap-transfer'),
    turn('gap-post-explain'), turn('gap-post-transfer')] };
  assert.equal(conceptSummary(session, 'gap').status, 'verified');
  assert.equal(conceptSummary(session, 'gap').evidenceCount, 4);
});

test('阶段隔离：旧解释不补足复测或延时迁移，最新错误与未知撤回结论且历史保留', () => {
  const session = { turns: [turn('gap-explain'), turn('gap-transfer')] };
  assert.equal(conceptSummary(session, 'gap').status, 'verified');
  session.turns.push(turn('gap-post-transfer'));
  assert.equal(conceptSummary(session, 'gap').status, 'developing');
  session.turns.push(turn('gap-post-explain'));
  assert.equal(conceptSummary(session, 'gap').status, 'verified');
  session.turns.push(turn('gap-delayed-explain', 'insufficient'));
  assert.equal(conceptSummary(session, 'gap').status, 'unknown');
  assert.equal(conceptSummary(session, 'gap').score, null);
  session.turns.push(turn('gap-delayed-transfer'), turn('gap-delayed-explain'));
  assert.equal(conceptSummary(session, 'gap').status, 'verified');
  session.turns.push(turn('gap-delayed-transfer', 'wrong'));
  const result = conceptSummary(session, 'gap');
  assert.notEqual(result.status, 'verified'); assert.equal(result.evidenceCount, 8);
  assert.deepEqual(result.evidenceIds, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('最新完整解释不足时不能用短追问替换解释门槛', () => {
  const session = { turns: [turn('gap-explain', 'wrong'), turn('gap-transfer'), turn('gap-probe')] };
  assert.equal(conceptSummary(session, 'gap').status, 'developing');
  assert.equal(conceptSummary({ turns: [turn('gap-explain'), turn('gap-transfer'), turn('gap-probe', 'wrong')] }, 'gap').status, 'developing');
});

test('修正旧误解后不把已经解决的旧标签继续当成当前误解', () => {
  const session = { turns: [turn('gap-probe', 'wrong', undefined, ['仅凭训练高分断言过拟合']),
    turn('gap-explain'), turn('gap-transfer')] };
  assert.equal(conceptSummary(session, 'gap').status, 'verified');
  assert.deepEqual(conceptSummary(session, 'gap').misconceptions, []);
  assert.equal(session.turns[0].assessment.misconceptions.length, 1);
});

test('十轮预算内先覆盖五能力，再区分固定基线与自适应问题', () => {
  for (const strategy of ['adaptive', 'fixed']) {
    for (const correctness of ['correct', 'partial', 'wrong', 'insufficient']) {
      const session = { turns: [], strategy };
      let next = nextDiagnostic(session);
      while (next) {
        const assessment = { correctness, misconceptions: correctness === 'wrong' ? ['测试误解'] : [] };
        const eligible = eligibleDiagnostic(session);
        assert.ok(eligible.some(item => item.id === next.id));
        session.turns.push({ task: next, assessment });
        assert.ok(session.turns.length <= 10);
        next = nextDiagnostic(session, next, assessment);
      }
      assert.equal(session.turns.length, 10);
      assert.equal(new Set(session.turns.map(item => item.task.id)).size, 10);
      assert.deepEqual(session.turns.slice(0, 5).map(item => item.task.conceptId), CONCEPTS.map(item => item.id));
      if (strategy === 'fixed') assert.ok(session.turns.slice(5).every(item => item.task.kind === 'transfer'));
      if (strategy === 'adaptive' && correctness !== 'correct') assert.ok(session.turns.some(item => item.task.id.endsWith('-probe')));
      assert.deepEqual(eligibleDiagnostic(session), []);
    }
  }
});

test('模型规划候选不允许跳过覆盖、不允许提前取复测或超过预算', () => {
  const session = { turns: [] };
  assert.deepEqual(eligibleDiagnostic(session).map(item => item.id), ['gap-explain']);
  session.turns.push(turn('gap-explain', 'wrong'));
  assert.deepEqual(eligibleDiagnostic(session).map(item => item.id), ['complexity-explain']);
  for (const concept of CONCEPTS.slice(1)) session.turns.push(turn(`${concept.id}-explain`, 'wrong'));
  assert.ok(eligibleDiagnostic(session).every(item => item.phase === 'diagnostic'));
  assert.equal(nextDiagnostic(session, taskById('validation-explain'), { correctness: 'wrong', misconceptions: [] }).id, 'validation-probe');
  assert.deepEqual(eligibleDiagnostic({ ...session, phase: 'posttest' }), []);
});

test('关键词评估明确说明局限，未知不视为错误，并识别正则过强风险', () => {
  const item = taskById('regularization-transfer');
  assert.equal(offlineAssess(item, '不知道怎么回答').correctness, 'insufficient');
  assert.equal(offlineAssess(item, '不能继续增大，正则过强会欠拟合，用验证集选择适度系数。').correctness, 'correct');
  const wrong = offlineAssess(item, '我认为正则化越强越好，所以继续增大。');
  assert.equal(wrong.correctness, 'wrong');
  assert.match(wrong.rationale, /关键词|不理解语义/);
  assert.match(wrong.rationale, /不能作为真实掌握标签/);
  const gapTransfer = taskById('gap-transfer');
  assert.match(gapTransfer.prompt, /90%/);
  assert.match(gapTransfer.prompt, /基准/);
});

test('讲解呈现明确误解与修正边界，三阶段题干不包含讲解例题', () => {
  const session = { turns: [turn('regularization-explain', 'wrong', undefined, ['正则化越强越好'])] };
  const lesson = createLesson(session, 'regularization');
  assert.deepEqual(lesson.misconceptions, ['正则化越强越好']);
  assert.match(lesson.sections[0][1], /正则化越强越好/);
  assert.match(JSON.stringify(lesson.sections), /欠拟合/);
  assert.match(JSON.stringify(lesson.sections), /不能把增大系数当成单向改善/);
  assert.match(lesson.source, /curated/);
  assert.throws(() => createLesson(session, 'missing'), /未知/);
  const before = JSON.stringify(lesson.sections);
  createLesson({ turns: [] }, 'regularization').sections.push(['临时', '测试']);
  assert.equal(JSON.stringify(createLesson(session, 'regularization').sections), before);
});

test('帮助等级逐步增加，只对诊断开放，复测与延时不返回答案或提示', () => {
  for (const concept of CONCEPTS) {
    const task = taskById(`${concept.id}-explain`);
    const hints = [1, 2, 3].map(level => selectHint(task, level));
    assert.equal(new Set(hints.map(item => item.text)).size, 3);
    assert.ok(hints.every(item => item.answerSeen === false));
    assert.equal(selectHint(taskById(`${concept.id}-post-explain`), 3), null);
    assert.equal(selectHint(taskById(`${concept.id}-delayed-transfer`), 3), null);
  }
  assert.throws(() => selectHint(TASKS[0], 0), /提示等级/);
  assert.throws(() => selectHint(TASKS[0], 4), /提示等级/);
});
