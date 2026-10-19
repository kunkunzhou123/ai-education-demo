'use strict';

// Offline, descriptive evaluation. No model calls and no inferred human labels.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const CORRECTNESS = ['correct', 'partial', 'wrong', 'insufficient'];
const MASTERY = ['verified', 'developing', 'needs_work', 'unknown'];
const DIMENSIONS = ['domainVersion', 'provider', 'model', 'strategy', 'phase'];
const SEP = '\u001f';
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

function loadRecords(files) {
  return files.flatMap(file => fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    let row;
    try { row = JSON.parse(line); } catch { throw new Error(`${file}:${index + 1} 不是合法 JSON`); }
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`${file}:${index + 1} 必须是事件对象`);
    return [{ row, source: { file: path.resolve(file), line: index + 1 } }];
  }));
}

function collectData(input) {
  const records = input.map((value, index) => value.row ? value : { row: value, source: { file: null, line: index + 1 } });
  const metadata = new Map(), unique = new Map(), conflicts = [], warnings = [];
  let duplicateEvents = 0;
  for (const entry of records) {
    const row = entry.row, sid = text(row.sessionId);
    if (!sid) { warnings.push({ reason: 'missing_session_id', source: entry.source }); continue; }
    const previous = metadata.get(sid) || {};
    const projection = row.projection || {};
    const next = { ...previous };
    for (const key of ['domainVersion', 'participantId', 'strategy']) {
      const value = text(row[key]) || text(projection[key]);
      if (value) {
        if (previous[key] && previous[key] !== value) throw new Error(`会话 ${sid} 的 ${key} 不一致；不能安全合并`);
        next[key] = value;
      }
    }
    metadata.set(sid, next);
    // Export wrappers and full server snapshots do not create extra observations.
    const { projection: ignoredProjection, hash: ignoredHash, previousHash: ignoredPrevious,
      exportHash: ignoredExport, previousExportHash: ignoredExportPrevious, sourceHash: ignoredSource, ...payload } = row;
    const identity = Number.isInteger(row.seq) ? `${sid}${SEP}seq:${row.seq}` : `${sid}${SEP}${hash(stable(payload))}`;
    const existing = unique.get(identity);
    if (existing) {
      if (stable(existing.payload) !== stable(payload)) throw new Error(`会话 ${sid} 存在内容冲突的重复序号 ${row.seq}`);
      existing.sources.push(entry.source); duplicateEvents++; continue;
    }
    unique.set(identity, { ...entry, payload, sources: [entry.source] });
  }
  const answers = new Map(), answerLabels = new Map(), masteryLabels = new Map();
  const keyFor = (row, item) => [text(row.domainVersion) || metadata.get(row.sessionId)?.domainVersion || 'legacy-unknown', row.sessionId, item].join(SEP);
  for (const entry of unique.values()) {
    const row = entry.row;
    if (row.event === 'answer_assessed') {
      const key = keyFor(row, row.turnId);
      if (row.turnId === undefined || !row.task || typeof row.answer !== 'string') { warnings.push({ reason: 'invalid_answer', source: entry.source }); continue; }
      if (answers.has(key) && stable(answers.get(key).row) !== stable(row)) { conflicts.push({ kind: 'answer', key }); answers.get(key).conflicted = true; continue; }
      answers.set(key, { ...entry, key, meta: metadata.get(row.sessionId) || {} });
    }
    if (!['human_annotation', 'mastery_annotation'].includes(row.event)) continue;
    const label = row.humanLabel;
    // Neither projection.humanMastery nor answer.humanLabel is a label source.
    // An explicit annotation event is still not proof of the annotator's identity.
    if (!label || !text(label.annotator) || /^(model|automatic|synthetic|auto)$/i.test(label.source || row.labelSource || '')) {
      warnings.push({ reason: 'invalid_human_annotation', source: entry.source }); continue;
    }
    const mastery = row.event === 'mastery_annotation';
    if (!(mastery ? MASTERY.includes(label.status) && text(label.conceptId) && text(label.phase) : CORRECTNESS.includes(label.correctness) && row.turnId !== undefined)) {
      warnings.push({ reason: 'invalid_label_value', source: entry.source }); continue;
    }
    const key = keyFor(row, mastery ? `${label.conceptId}:${label.phase}` : row.turnId);
    const map = mastery ? masteryLabels : answerLabels;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ ...entry, key, label });
  }
  return { answers, answerLabels, masteryLabels, metadata, conflicts, warnings, duplicateEvents, uniqueEvents: unique.size };
}

function latestLabels(entries, { blindOnly = false } = {}) {
  const byAnnotator = new Map();
  // Resolve revisions before blind filtering: do not resurrect an older label.
  for (const entry of entries || []) {
    const name = entry.label.annotator.trim(), previous = byAnnotator.get(name);
    const time = Date.parse(entry.label.labeledAt || entry.row.timestamp || '');
    const rank = Number.isFinite(time) ? time : Number(entry.row.seq) || 0;
    const candidate = { ...entry, rank };
    if (!previous || rank > previous.rank) byAnnotator.set(name, candidate);
    else if (rank === previous.rank && stable(entry.label) !== stable(previous.label)) {
      byAnnotator.set(name, { ...previous, revisionConflict: true });
    }
  }
  return [...byAnnotator.values()].filter(entry => !blindOnly || entry.label.blind === true);
}

function consensus(entries, field, options) {
  const labels = latestLabels(entries, options);
  if (!labels.length) return { status: 'unlabelled', labels: [] };
  if (labels.some(entry => entry.revisionConflict)) return { status: 'disputed', reason: 'ambiguous_revision', labels };
  const values = [...new Set(labels.map(entry => entry.label[field]))];
  if (values.length !== 1) return { status: 'disputed', reason: 'annotator_disagreement', labels };
  return { status: 'consensus', value: values[0], labels };
}

function groupFor(row, meta = {}, overrides = {}) {
  return {
    domainVersion: text(row.domainVersion) || meta.domainVersion || 'legacy-unknown',
    provider: text(row.assessment?.provider) || 'unknown', model: text(row.assessment?.model) || 'none',
    strategy: text(row.strategy) || meta.strategy || 'legacy', phase: text(row.task?.phase) || 'unknown', ...overrides
  };
}
function metric(items, categories, positive) {
  const matrix = Object.fromEntries(categories.map(gold => [gold, Object.fromEntries(categories.map(pred => [pred, 0]))]));
  const matched = items.filter(item => categories.includes(item.pred) && categories.includes(item.gold));
  for (const item of matched) matrix[item.gold][item.pred]++;
  const result = { labelled: matched.length, confusionMatrix: { rows: 'human_consensus', columns: 'prediction', values: matrix } };
  if (!matched.length) return { ...result, metricsAvailable: false, reason: '没有可用的一致人工标签；不报告准确率或 F1。' };
  let agreement = 0, predictedPositive = 0, falsePositive = 0;
  const perClass = {};
  for (const name of categories) {
    const tp = matrix[name][name], support = categories.reduce((n, pred) => n + matrix[name][pred], 0);
    const predicted = categories.reduce((n, gold) => n + matrix[gold][name], 0);
    const fp = predicted - tp, fn = support - tp;
    perClass[name] = { support, predicted, precision: predicted ? tp / predicted : null, recall: support ? tp / support : null, f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null };
    agreement += tp;
    if (name === positive) { predictedPositive = predicted; falsePositive = fp; }
  }
  const observed = categories.filter(name => perClass[name].f1 !== null);
  return { ...result, metricsAvailable: true, agreement, agreementRate: agreement / matched.length,
    macroF1: observed.reduce((n, name) => n + perClass[name].f1, 0) / observed.length, macroF1Labels: observed,
    perClass, predictedPositive, falsePositive, falseConfirmationRate: predictedPositive ? falsePositive / predictedPositive : null };
}
function grouped(items, categories, positive) {
  const groups = new Map();
  for (const item of items) {
    const key = DIMENSIONS.map(name => item.group[name]).join(SEP);
    if (!groups.has(key)) groups.set(key, { group: item.group, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()].map(({ group, items: values }) => ({ ...group,
    observations: values.length, sessions: new Set(values.map(item => item.sessionId)).size,
    unlabelled: values.filter(item => item.status === 'unlabelled').length,
    disputed: values.filter(item => item.status === 'disputed').length,
    invalidPredictions: values.filter(item => item.status === 'consensus' && !categories.includes(item.pred)).length,
    ...metric(values.filter(item => item.status === 'consensus'), categories, positive) }));
}
function condition(row) {
  const support = row.support || {}, rawLevel = support.level ?? row.task?.hintLevel;
  const known = rawLevel !== undefined && Number.isFinite(Number(rawLevel)) && Number(rawLevel) >= 0;
  const level = known ? Number(rawLevel) : null;
  return { level, answerSeen: support.answerSeen === true,
    condition: support.answerSeen === true ? 'assisted' : !known ? 'unknown' : level === 0 ? 'independent' : 'assisted' };
}

function evaluateRecords(records, { blindOnly = false } = {}) {
  const data = collectData(records), turns = [], mastery = [], disputes = [];
  for (const [key, entry] of data.answers) {
    const { row, meta } = entry;
    const label = entry.conflicted ? { status: 'disputed', reason: 'answer_conflict', labels: [] } : consensus(data.answerLabels.get(key), 'correctness', { blindOnly });
    if (label.status === 'disputed') disputes.push({ kind: 'turn', sessionId: row.sessionId, turnId: row.turnId, reason: label.reason, annotators: label.labels.map(value => ({ annotator: value.label.annotator, label: value.label.correctness })) });
    turns.push({ sessionId: row.sessionId, participantId: meta.participantId, group: groupFor(row, meta), ...condition(row), pred: row.assessment?.correctness, gold: label.value, status: label.status });
  }
  for (const [key, entries] of data.masteryLabels) {
    const label = consensus(entries, 'status', { blindOnly }), exemplar = label.labels.at(-1) || entries.at(-1);
    const row = exemplar.row, human = exemplar.label, meta = data.metadata.get(row.sessionId) || {};
    const evidence = [...data.answers.values()].filter(value => value.row.sessionId === row.sessionId && value.row.task.conceptId === human.conceptId && value.row.task.phase === human.phase);
    const uniqueValue = field => { const values = [...new Set(evidence.map(value => groupFor(value.row, value.meta)[field]))]; return values.length === 1 ? values[0] : values.length ? 'mixed' : 'unknown'; };
    const predictions = [...new Set(label.labels.map(value => value.row.modelStatus).filter(Boolean))];
    const status = predictions.length > 1 ? 'disputed' : label.status;
    if (status === 'disputed') disputes.push({ kind: 'mastery', sessionId: row.sessionId, conceptId: human.conceptId, phase: human.phase, reason: predictions.length > 1 ? 'prediction_changed_between_annotations' : label.reason, annotators: label.labels.map(value => ({ annotator: value.label.annotator, label: value.label.status })) });
    mastery.push({ sessionId: row.sessionId, participantId: meta.participantId, group: groupFor(row, meta, { provider: uniqueValue('provider'), model: uniqueValue('model'), phase: human.phase }), pred: predictions[0], gold: label.value, status });
  }
  const helpMap = new Map();
  for (const turn of turns) {
    const key = [...DIMENSIONS.map(name => turn.group[name]), turn.condition, turn.level, turn.answerSeen].join(SEP);
    if (!helpMap.has(key)) helpMap.set(key, { ...turn.group, condition: turn.condition, hintLevel: turn.level, answerSeen: turn.answerSeen, items: [] });
    helpMap.get(key).items.push(turn);
  }
  const helpConditions = [...helpMap.values()].map(({ items, ...group }) => {
    const labelled = items.filter(item => item.status === 'consensus');
    return { ...group, turns: items.length, sessions: new Set(items.map(item => item.sessionId)).size,
      predictionCounts: Object.fromEntries(CORRECTNESS.map(value => [value, items.filter(item => item.pred === value).length])),
      humanLabelCounts: Object.fromEntries(CORRECTNESS.map(value => [value, labelled.filter(item => item.gold === value).length])),
      ...(labelled.length ? { humanCorrectRate: labelled.filter(item => item.gold === 'correct').length / labelled.length } : {}),
      ...metric(labelled, CORRECTNESS, 'correct') };
  });
  const strategyMap = new Map();
  for (const item of turns) {
    if (!['fixed', 'adaptive'].includes(item.group.strategy)) continue;
    const key = ['domainVersion', 'provider', 'model', 'phase'].map(name => item.group[name]).join(SEP);
    if (!strategyMap.has(key)) strategyMap.set(key, { ...item.group, strategy: undefined, items: [] });
    strategyMap.get(key).items.push(item);
  }
  const strategyComparison = [...strategyMap.values()].map(({ items, strategy: ignored, ...group }) => ({ ...group,
    strategies: ['fixed', 'adaptive'].map(strategy => {
      const subset = items.filter(item => item.group.strategy === strategy);
      const independent = subset.filter(item => item.condition === 'independent' && item.status === 'consensus');
      const participants = new Set(subset.map(item => item.participantId || `session:${item.sessionId}`));
      return { strategy, turns: subset.length, sessions: new Set(subset.map(item => item.sessionId)).size, participants: participants.size,
        independentlyLabelledTurns: independent.length,
        ...(independent.length ? { independentHumanCorrectRate: independent.filter(item => item.gold === 'correct').length / independent.length } : {}),
        assessment: metric(subset.filter(item => item.status === 'consensus'), CORRECTNESS, 'correct') };
    }), note: '描述性、非随机对照；会话/轮次不独立，题目选择和学生差异会混杂结果，不能解释为自适应策略的因果效果。' }));
  return { schemaVersion: 2, labelPolicy: { blindOnly, revisions: '同一标注者按 labeledAt/timestamp 的最后时间修订；同时间冲突排除。', consensus: '不同标注者必须一致；分歧项排除指标，不选择最后一人的标签。', identity: '标注者代号与 blind 标记未经身份或流程审核，不代表教师/专家 gold。', macroF1: '对人工标签或预测中出现的类别取宏平均；同时返回参与类别及逐类指标。', falseConfirmationRate: '预测为 correct/verified 但人工一致标签不是该类别的数量，除以预测 correct/verified 的数量；分母为零时 null。' },
    data: { inputEvents: records.length, uniqueEvents: data.uniqueEvents, duplicateEvents: data.duplicateEvents, sessions: data.metadata.size, warnings: data.warnings },
    turns: { total: turns.length, unlabelled: turns.filter(item => item.status === 'unlabelled').length, disputed: turns.filter(item => item.status === 'disputed').length, groups: grouped(turns, CORRECTNESS, 'correct') },
    mastery: { total: mastery.length, disputed: mastery.filter(item => item.status === 'disputed').length, groups: grouped(mastery, MASTERY, 'verified') },
    helpConditions, strategyComparison, disputes,
    note: '按域版本、provider、model、strategy、phase 分组，不跨域汇总准确率。自动判分不是学习效果真值；独立即时/延时测试应单独报告。' };
}

if (require.main === module) {
  const args = process.argv.slice(2), blindOnly = args.includes('--blind-only'), files = args.filter(value => value !== '--blind-only');
  if (!files.length) { console.error('用法：node scripts/evaluate.js [--blind-only] 会话记录.jsonl [更多记录.jsonl]'); process.exitCode = 1; }
  else try { console.log(JSON.stringify(evaluateRecords(loadRecords(files), { blindOnly }), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { CORRECTNESS, MASTERY, DIMENSIONS, loadRecords, collectData, latestLabels, consensus, condition, groupFor, evaluateRecords, hash };
