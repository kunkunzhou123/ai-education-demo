'use strict';

// Construct assessor SFT examples from explicit, independently submitted labels.
const fs = require('node:fs');
const path = require('node:path');
const { collectData, consensus, condition, loadRecords, hash } = require('./evaluate');
const SYSTEM = '你是学习证据评估员。根据当前任务、评分标准、学生原话、必要历史和帮助条件评估当前回答。允许证据不足，不推断稳定掌握概率。仅输出 JSON，字段为 correctness、evidenceQuote、note；引用必须来自当前学生回答。';
function splitFor(participantKey) {
  const bucket = parseInt(hash(participantKey).slice(0, 8), 16) % 100;
  return bucket < 80 ? 'train' : bucket < 90 ? 'validation' : 'test';
}
function supportFor(row) {
  const support = row.support || {}, descriptor = condition(row);
  return { level: descriptor.level, condition: descriptor.condition, answerSeen: descriptor.answerSeen,
    hints: (Array.isArray(support.hints) ? support.hints : []).map(item => ({ level: item.level, text: item.text || item.content || item.hint || '', answerSeen: item.answerSeen === true })) };
}
function safeHistory(row) {
  return (Array.isArray(row.context) ? row.context : []).map(item => ({
    turnId: item.turnId, question: item.question || item.task?.prompt || '', answer: typeof item.answer === 'string' ? item.answer : '',
    phase: item.phase || item.task?.phase || 'unknown', support: supportFor(item)
  })).filter(item => item.question || item.answer);
}
function buildDataset(records, { includeUnblinded = false } = {}) {
  const data = collectData(records), output = { train: [], validation: [], test: [] };
  const skipped = { unlabelled: 0, disputed: 0, answerConflict: 0, missingRubric: 0, invalidEvidence: 0 };
  const domains = new Set();
  let labelsUsed = 0, unblindedLabelsUsed = 0;
  for (const [key, entry] of data.answers) {
    const { row, meta } = entry;
    if (entry.conflicted) { skipped.answerConflict++; continue; }
    const label = consensus(data.answerLabels.get(key), 'correctness', { blindOnly: !includeUnblinded });
    if (label.status !== 'consensus') { skipped[label.status]++; continue; }
    const rubric = row.task.rubric || row.task.criteria;
    if (!rubric || (Array.isArray(rubric) && !rubric.length)) { skipped.missingRubric++; continue; }
    const usable = label.labels.filter(item => item.label.evidenceQuote == null || typeof item.label.evidenceQuote === 'string' && row.answer.includes(item.label.evidenceQuote));
    if (usable.length !== label.labels.length) { skipped.invalidEvidence++; continue; }
    // Retain all agreeing annotators as provenance; one stable target per turn.
    const selected = [...usable].sort((a, b) => a.label.annotator.localeCompare(b.label.annotator, 'en'))[0];
    const gold = selected.label;
    const participantKey = meta.participantId ? `participant:${meta.participantId}` : `session:${row.sessionId}`;
    const split = splitFor(participantKey);
    const domainVersion = row.domainVersion || meta.domainVersion || 'legacy-unknown'; domains.add(domainVersion);
    const input = { domainVersion, task: { id: row.task.id, conceptId: row.task.conceptId, kind: row.task.kind, phase: row.task.phase,
      prompt: row.task.prompt, form: row.task.form, difficulty: row.task.difficulty },
      rubric: Array.isArray(rubric) ? rubric.map(item => typeof item === 'string' ? item : item.label).filter(Boolean) : rubric,
      answer: row.answer, support: supportFor(row), history: safeHistory(row) };
    const target = { correctness: gold.correctness, evidenceQuote: gold.evidenceQuote || null, note: gold.note || '' };
    const provenance = { sessionId: row.sessionId, turnId: row.turnId, domainVersion, participantKey, split,
      sourceEvent: 'answer_assessed', sourceFiles: entry.sources, sourceHash: row.sourceHash || row.hash || null,
      annotationPolicy: includeUnblinded ? 'explicit-human-consensus-including-unblinded' : 'blind-explicit-human-consensus',
      annotatorIdentityVerified: false, blind: usable.every(item => item.label.blind === true),
      labels: usable.map(item => ({ annotator: item.label.annotator, correctness: item.label.correctness,
        evidenceQuote: item.label.evidenceQuote || null, note: item.label.note || '', blind: item.label.blind === true,
        labeledAt: item.label.labeledAt || item.row.timestamp || null, sourceFiles: item.sources })) };
    output[split].push({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(input) }, { role: 'assistant', content: JSON.stringify(target) }], provenance });
    labelsUsed += usable.length; unblindedLabelsUsed += usable.filter(item => item.label.blind !== true).length;
  }
  const manifest = { schemaVersion: 1, purpose: '评估员监督微调候选数据；不是教师回复生成数据。',
    deploymentCompatibility: { onlineToolCompatible: false, target: 'correctness/evidenceQuote/note 判分子任务',
      limitation: '在线运行还要求原生 tool_calls 与完整 record_assessment 六字段协议。此候选集不能训练后直接替换在线角色；部署前需补充相应人工标注、工具协议训练与适配验证。不得用模型自动字段补齐缺少的人工目标。' },
    splitPolicy: { unit: 'participantId；缺失时 sessionId', algorithm: 'SHA-256(key) 前 32 位 mod 100；0–79 train、80–89 validation、90–99 test', stable: true,
      limitation: '匿名代号并不证明真实身份；同一人使用多个代号仍可能跨集合。小样本可能产生空集合，禁止逐轮重分配来填满集合。' },
    labels: { includeUnblinded, labelsUsed, unblindedLabelsUsed, consensus: '先取每位标注者最后修订，再要求判分类别一致；分歧和同时间修订冲突全部跳过。',
      target: '仅来自明确 human_annotation 事件中的 correctness、evidenceQuote、note；不使用模型 assessment、人为嵌入的 answer.humanLabel 或 projection 标签。',
      identityVerified: false, warning: 'blind:true 是自报流程属性，未审核标注者身份，不能称为专家 gold。合成/开发会话即使被人工标注也不等同真实学生数据；训练前须审核授权、去标识、标签质量与数据来源。' },
    counts: { answers: data.answers.size, examples: Object.values(output).reduce((n, rows) => n + rows.length, 0),
      splits: Object.fromEntries(Object.entries(output).map(([name, rows]) => [name, { examples: rows.length, participants: new Set(rows.map(row => row.provenance.participantKey)).size, sessions: new Set(rows.map(row => row.provenance.sessionId)).size }])), skipped,
      duplicateEvents: data.duplicateEvents },
    domainVersions: [...domains].sort(), warnings: data.warnings,
    leakagePolicy: '同一学习者所有会话稳定分到同一集合；同任务模板可能跨集合，若研究跨任务泛化需另行按任务留出。测试集不得用于提示词、阈值或模型选择。' };
  return { ...output, manifest };
}

function main(args) {
  const position = args.indexOf('--out');
  if (position < 0 || !args[position + 1] || args[position + 1].startsWith('--')) throw new Error('用法：node scripts/build-dataset.js --out 输出目录 [--include-unblinded] 会话记录.jsonl [更多记录.jsonl]');
  const out = path.resolve(args[position + 1]), includeUnblinded = args.includes('--include-unblinded');
  const files = args.filter((value, index) => index !== position && index !== position + 1 && value !== '--include-unblinded');
  if (!files.length || files.some(value => value.startsWith('--'))) throw new Error('请提供有效的 JSONL 文件路径');
  const dataset = buildDataset(loadRecords(files), { includeUnblinded });
  fs.mkdirSync(out, { recursive: true });
  for (const name of ['train.jsonl', 'validation.jsonl', 'test.jsonl', 'manifest.json']) {
    if (fs.existsSync(path.join(out, name))) throw new Error(`${path.join(out, name)} 已存在；请使用新的输出目录`);
  }
  for (const split of ['train', 'validation', 'test']) fs.writeFileSync(path.join(out, `${split}.jsonl`), dataset[split].map(row => JSON.stringify(row)).join('\n') + (dataset[split].length ? '\n' : ''), { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(dataset.manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ out, ...dataset.manifest.counts }, null, 2));
}
if (require.main === module) try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
module.exports = { buildDataset, splitFor, main };
