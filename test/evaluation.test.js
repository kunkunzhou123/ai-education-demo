'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { evaluateRecords } = require('../scripts/evaluate');
const { buildDataset, splitFor } = require('../scripts/build-dataset');

function answer(sessionId = 'session-a', extra = {}) {
  return { event: 'answer_assessed', domainVersion: 'overfitting-v2.0.0', sessionId, turnId: 1,
    timestamp: '2026-10-20T12:00:00.000Z', participantId: 'learner-a', strategy: 'adaptive',
    task: { id: 'gap-explain', conceptId: 'gap', kind: 'explain', phase: 'diagnostic', prompt: '请解释。', hintLevel: 0, rubric: ['解释训练和验证的差别'] },
    answer: '训练和验证差距说明泛化存在问题。', support: { level: 0, answerSeen: false },
    assessment: { correctness: 'correct', provider: 'offline-rules', model: null, rationale: 'AUTOMATIC SECRET', evidenceQuotes: ['AUTO QUOTE'] }, ...extra };
}
function annotation(sessionId = 'session-a', extra = {}) {
  return { event: 'human_annotation', domainVersion: 'overfitting-v2.0.0', sessionId, turnId: 1,
    humanLabel: { annotator: 'reviewer-a', correctness: 'partial', blind: true, evidenceQuote: '泛化存在问题', note: '还需要数据条件', labeledAt: '2026-10-20T13:00:00.000Z', ...extra } };
}
const allExamples = dataset => [...dataset.train, ...dataset.validation, ...dataset.test];

test('多人分歧排除，不以最后标注者覆盖；同一标注者按时间修订', () => {
  const rows = [answer(), annotation(), annotation('session-a', { annotator: 'reviewer-b', correctness: 'correct', labeledAt: '2026-10-20T14:00:00.000Z' })];
  const report = evaluateRecords(rows);
  assert.equal(report.turns.disputed, 1);
  assert.equal(report.turns.groups[0].labelled, 0);
  assert.equal(report.turns.groups[0].metricsAvailable, false);
  assert.equal(report.disputes[0].reason, 'annotator_disagreement');
  assert.equal(allExamples(buildDataset(rows)).length, 0);
  rows.push(annotation('session-a', { correctness: 'correct', labeledAt: '2026-10-20T15:00:00.000Z' }));
  const revised = evaluateRecords(rows.slice().reverse());
  assert.equal(revised.turns.groups[0].labelled, 1);
  assert.equal(revised.turns.groups[0].agreementRate, 1);
  assert.equal(revised.turns.groups[0].macroF1, 1);
});

test('重复导出同一会话不重复计数，原始快照与导出事件可以合并', () => {
  const a = { ...answer(), seq: 1 }, label = { ...annotation(), seq: 2 };
  const exported = { ...a, sourceHash: 'source', exportHash: 'export', previousExportHash: null };
  const raw = { ...a, projection: { domainVersion: a.domainVersion, participantId: 'learner-a', strategy: 'adaptive', turns: [] }, hash: 'source', previousHash: null };
  const report = evaluateRecords([raw, label, exported, label]);
  assert.equal(report.turns.total, 1);
  assert.equal(report.turns.groups[0].labelled, 1);
  assert.equal(report.turns.groups[0].falseConfirmationRate, 1);
  assert.equal(report.data.duplicateEvents, 2);
  const result = buildDataset([raw, label, exported, label]);
  assert.equal(allExamples(result).length, 1);
  assert.equal(allExamples(result)[0].provenance.sourceFiles.length, 2);
  assert.throws(() => evaluateRecords([a, { ...a, answer: '不同回答' }]), /重复序号/);
});

test('自动字段和投影标签都不能变成人工训练标签，缺标签不产生虚假指标', () => {
  const fake = { correctness: 'correct', annotator: 'made-up', blind: true };
  const row = answer('session-a', { humanLabel: fake, projection: { humanMastery: { gap: fake }, turns: [{ humanLabel: fake }] } });
  const report = evaluateRecords([row]);
  assert.equal(report.turns.unlabelled, 1);
  assert.equal(report.turns.groups[0].metricsAvailable, false);
  assert.equal('agreementRate' in report.turns.groups[0], false);
  assert.equal('macroF1' in report.turns.groups[0], false);
  assert.equal(allExamples(buildDataset([row])).length, 0);
  const autoEvent = annotation('session-a', { source: 'model' });
  assert.equal(allExamples(buildDataset([row, autoEvent])).length, 0);
});

test('评测按五维拆分且知识点与逐轮独立；帮助条件与策略比较标明非因果', () => {
  const a = answer();
  const b = answer('session-b', { domainVersion: 'overfitting-v3.0.0', participantId: 'learner-b', strategy: 'fixed',
    task: { ...a.task, phase: 'posttest' }, support: { level: 2, answerSeen: false }, assessment: { correctness: 'wrong', provider: 'api', model: 'model-b' } });
  const mb = { event: 'mastery_annotation', sessionId: 'session-b', domainVersion: b.domainVersion, modelStatus: 'verified',
    humanLabel: { conceptId: 'gap', phase: 'posttest', status: 'developing', annotator: 'reviewer', blind: true, labeledAt: '2026-10-20T14:00:00Z' } };
  const report = evaluateRecords([a, annotation(), b, { ...annotation('session-b'), domainVersion: b.domainVersion }, mb]);
  assert.equal(report.turns.groups.length, 2);
  assert.deepEqual(report.turns.groups.map(group => [group.domainVersion, group.provider, group.model, group.strategy, group.phase]), [
    ['overfitting-v2.0.0', 'offline-rules', 'none', 'adaptive', 'diagnostic'],
    ['overfitting-v3.0.0', 'api', 'model-b', 'fixed', 'posttest']
  ]);
  assert.equal(report.mastery.groups[0].falseConfirmationRate, 1);
  assert.equal(report.mastery.groups[0].confusionMatrix.values.developing.verified, 1);
  assert.deepEqual(new Set(report.helpConditions.map(item => item.condition)), new Set(['independent', 'assisted']));
  assert.equal(report.strategyComparison.length, 2);
  assert.ok(report.strategyComparison.every(item => /不能解释.*因果/.test(item.note)));
  assert.match(report.labelPolicy.identity, /未经身份/);
});

test('SFT 默认只接受盲标，输入和目标不泄露自动评估；保留独立人工目标和来源', () => {
  const row = answer('session-a', { context: [{ turnId: 0, question: '之前的问题', answer: '之前的回答', assessment: { rationale: 'HISTORY SECRET' }, support: { level: 1 } }] });
  const result = buildDataset([row, annotation()]);
  const example = allExamples(result)[0], user = JSON.parse(example.messages[1].content), target = JSON.parse(example.messages[2].content);
  assert.equal(user.answer, row.answer);
  assert.deepEqual(user.rubric, row.task.rubric);
  assert.equal(user.support.condition, 'independent');
  assert.equal(user.history[0].support.condition, 'assisted');
  assert.deepEqual(target, { correctness: 'partial', evidenceQuote: '泛化存在问题', note: '还需要数据条件' });
  assert.ok(!JSON.stringify(example.messages).includes('AUTOMATIC SECRET'));
  assert.ok(!JSON.stringify(example.messages).includes('HISTORY SECRET'));
  assert.ok(!JSON.stringify(example.messages).includes('AUTO QUOTE'));
  assert.equal(example.provenance.annotatorIdentityVerified, false);
  assert.equal(example.provenance.domainVersion, row.domainVersion);
  const unblind = [row, annotation('session-a', { blind: false })];
  assert.equal(allExamples(buildDataset(unblind)).length, 0);
  assert.equal(allExamples(buildDataset(unblind, { includeUnblinded: true })).length, 1);
  const revisedUnblind = [row, annotation(), annotation('session-a', { blind: false, labeledAt: '2026-10-20T15:00:00Z' })];
  assert.equal(allExamples(buildDataset(revisedUnblind)).length, 0);
});

test('SFT 按学习者稳定切分，多会话和多域同一人不跨集合；所有集合可重现', () => {
  const records = [];
  for (let person = 0; person < 120; person++) for (let session = 0; session < 2; session++) {
    const id = `p${person}-s${session}`, version = `version-${session}`;
    records.push(answer(id, { participantId: `person-${person}`, domainVersion: version }), { ...annotation(id), domainVersion: version });
  }
  const forward = buildDataset(records), backward = buildDataset(records.slice().reverse());
  const owners = new Map();
  for (const split of ['train', 'validation', 'test']) {
    assert.ok(forward[split].length > 0);
    for (const example of forward[split]) {
      const key = example.provenance.participantKey;
      assert.equal(owners.get(key) || split, split);
      owners.set(key, split);
      assert.equal(splitFor(key), split);
    }
    assert.deepEqual(forward[split].map(item => item.provenance.sessionId).sort(), backward[split].map(item => item.provenance.sessionId).sort());
  }
  assert.equal(allExamples(forward).length, 240);
  assert.deepEqual(forward.manifest.domainVersions, ['version-0', 'version-1']);
  assert.equal(new Set(allExamples(forward).filter(item => item.provenance.participantKey === 'participant:person-10').map(item => item.provenance.split)).size, 1);
});

test('伪造证据与同时间修订冲突跳过；CLI 写出 manifest 并拒绝覆盖原数据', () => {
  const bad = buildDataset([answer(), annotation('session-a', { evidenceQuote: '不在学生回答中的文本' })]);
  assert.equal(bad.manifest.counts.skipped.invalidEvidence, 1);
  const sameTime = [answer(), annotation(), annotation('session-a', { correctness: 'wrong' })];
  assert.equal(evaluateRecords(sameTime).turns.disputed, 1);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'education-dataset-test-'));
  try {
    const input = path.join(dir, 'input.jsonl'), out = path.join(dir, 'dataset');
    fs.writeFileSync(input, [answer(), annotation()].map(row => JSON.stringify(row)).join('\n'));
    const cli = path.resolve(__dirname, '../scripts/build-dataset.js');
    const run = () => spawnSync(process.execPath, [cli, '--out', out, input], { encoding: 'utf8' });
    const result = run(); assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
    assert.equal(manifest.counts.examples, 1);
    assert.match(manifest.labels.warning, /合成.*真实学生/);
    assert.equal(run().status, 1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')).counts.examples, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
