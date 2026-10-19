const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = {correct:'依据完整',partial:'部分理解',wrong:'存在明确错误',insufficient:'证据不足'};
const statuses = {verified:'本轮已验证',developing:'仍有理解缺口',needs_work:'需要补齐基础',unknown:'尚未确认'};
const storageKey = 'masterymap-dialogue-session';
const pendingKey = 'masterymap-dialogue-pending';
const draftKey = 'masterymap-dialogue-draft';
let session = null, busy = false, review = null, reviewDrafts = {};
let savedId = readStorage(storageKey), pendingAnswer = readJson(pendingKey);
$('resumeSession').hidden = !savedId;

function readStorage(key) { try {return localStorage.getItem(key);} catch {return null;} }
function readJson(key) { try {return JSON.parse(readStorage(key));} catch {return null;} }
function writeStorage(key, value) { try {value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value);} catch {} }
function showError(message) { $('notice').textContent = message || ''; $('notice').hidden = !message; }
function isRunBlocked() {return session?.run?.status === 'blocked';}
function blockedMessage() {return '本轮运行已达到预算或上下文限制，已暂停提交。请导出当前记录，或新建诊断继续。';}
function setBusy(value) {
  busy = value;
  document.querySelectorAll('button,input,select,textarea').forEach(el => {
    const blockedControl = isRunBlocked() && (['studentAnswer','sendAnswer','beginPosttest','beginDelayed'].includes(el.id) || el.dataset.hint !== undefined || el.dataset.teach !== undefined);
    el.disabled = value || blockedControl || el.dataset.locked === 'true';
  });
  if ($('studentAnswer')) $('studentAnswer').readOnly = !!pendingForCurrentTask();
  if ($('answerStatus')) $('answerStatus').textContent = value ? '正在处理，请稍候…' : isRunBlocked() ? blockedMessage() : pendingForCurrentTask() ? '上次提交尚未确认。重试会使用同一条回答，避免重复记录。' : '解释清楚即可；不确定的地方也可以写出来。';
}
function pendingForCurrentTask() { return pendingAnswer?.sessionId === session?.id && pendingAnswer?.taskId === session?.currentTask?.id ? pendingAnswer : null; }
function savePending(value) { pendingAnswer = value; writeStorage(pendingKey, value ? JSON.stringify(value) : null); }
async function api(action, body, id = session?.id || savedId) {
  const url = action === 'create' ? '/api/dialogue/sessions' : `/api/dialogue/sessions/${encodeURIComponent(id || '')}${action ? '/' + action : ''}`;
  const configuredTimeout = Number(session?.requestTimeoutMs);
  const requestTimeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 195000;
  const response = await fetch(url, {method:body !== undefined ? 'POST':'GET',headers:body !== undefined ? {'Content-Type':'application/json'}:{},body:body !== undefined ? JSON.stringify(body):undefined,signal:AbortSignal.timeout(requestTimeoutMs)});
  let data;
  try {data = await response.json();} catch {throw new Error('服务暂时没有返回可读取的结果，请稍后重试。');}
  if (!response.ok) {const error = new Error(data.error || '请求失败'); error.status = response.status; error.code = data.code; throw error;}
  return data;
}
function acceptSession(data) {
  session = data.session || data;
  savedId = session.id;
  writeStorage(storageKey, session.id);
  $('resumeSession').hidden = false;
  if (pendingAnswer && (pendingAnswer.sessionId !== session.id || pendingAnswer.taskId !== session.currentTask?.id)) savePending(null);
  if (session.pendingDraft?.taskId === session.currentTask?.id) savePending({...session.pendingDraft,sessionId:session.id});
}
async function perform(action, body) {
  if (busy) return;
  if (isRunBlocked() && ['answer','hint','teach','posttest','delayed'].includes(action)) {showError(blockedMessage()); setBusy(false); return;}
  setBusy(true); showError('');
  try {
    const data = await api(action, body);
    if (action === 'answer') {savePending(null); writeStorage(draftKey, null);}
    acceptSession(data); render();
  } catch (e) {
    if (e.status === 409) {
      try {acceptSession(await api('')); render();} catch {}
      showError('会话已经更新，已尝试读取最新进度。请确认当前问题后继续。');
    } else if ((e.status === 429 || e.code === 'CONTEXT_LIMIT') && session) {
      try {acceptSession(await api(''));} catch {}
      session.run = {...session.run,status:'blocked',retryable:false};
      render(); showError(blockedMessage());
    } else showError(e.name === 'TimeoutError' ? '请求超时，回答已保留。可重试同一请求，或刷新确认记录。' : e.message);
  } finally {setBusy(false);}
}
function list(value) {return Array.isArray(value) ? value : value ? [String(value)] : [];}
function supportOf(task, turn) {
  const raw = turn?.support || session?.supports?.[task?.id] || session?.taskHints?.[task?.id] || {};
  const hints = Array.isArray(raw) ? raw : list(raw.hints || (raw.text ? [raw] : []));
  const level = Number(raw.level ?? raw.hintLevel ?? Math.max(0, ...hints.map(h => Number(h.level) || 0)));
  return {level, hints};
}
function supportHtml(task, turn) {
  const support = supportOf(task, turn);
  return `<span class="support-badge ${support.level ? 'assisted':''}">${support.level ? `已使用 ${esc(support.level)} 级帮助 · 受助作答` : '独立尝试 · 未记录提示'}</span>${support.hints.map(h => `<div class="hint-message"><strong>${esc(h.level || support.level)} 级帮助</strong><p>${esc(typeof h === 'string' ? h : h.text)}</p></div>`).join('')}`;
}
function evidenceHtml(turn) {
  const a = turn.assessment;
  if (!a) return '';
  return `<details class="assessment"><summary>${esc(labels[a.correctness] || a.correctness)} · 查看回答证据</summary><p>${esc(a.rationale)}</p>${list(a.evidenceQuotes).map(q=>`<blockquote>${esc(q)}</blockquote>`).join('')}<p>体现：${esc(list(a.demonstrated).join('；') || '尚未确认')}<br>缺少：${esc(list(a.missing).join('；') || '未发现明确缺口')}<br>误解：${esc(list(a.misconceptions).join('；') || '未发现明确误解')}</p><small>评估来源：${esc(a.provider === 'offline-rules' ? '离线规则' : a.model || a.provider || '模型评估')}。需要人工复核时，请使用独立标注入口。</small></details>`;
}
function isIndependentPhase(phase) {return ['posttest','delayed','retention'].includes(phase);}
function phaseLabel(phase) {return ({diagnostic:'对话诊断',diagnosed:'诊断与学习记录',learning:'针对理解缺口学习',posttest:'新情境独立复测',delayed:'延时独立验证',retention:'延时独立验证',completed:'本轮学习记录'})[phase] || '学习记录';}
function retentionHtml() {
  const r = session.retention;
  if (!r?.dueAt) return '';
  const date = new Date(r.dueAt);
  const due = !Number.isNaN(date.valueOf()) ? date.toLocaleString('zh-CN') : String(r.dueAt);
  const completed = r.completed || r.status === 'completed' || r.completedAt;
  return `<section class="retention-card"><h3>过一段时间，再独立试一次</h3><p>${completed ? '延时验证已完成，结果已保留在记录中。' : `可开始时间：${esc(due)}。届时使用未见过的问题，检查理解是否保留。`}</p>${!completed ? `<button id="beginDelayed" class="secondary-button" data-locked="${!r.available}" ${r.available ? '' : 'disabled'}>${r.available ? '开始延时验证 →':'等待验证时间'}</button>`:''}</section>`;
}
function researchHtml() {
  const trace = list(session.trace);
  const budget = session.budget || {};
  const run = session.run || {};
  const budgetDescription = budget.description || `诊断最多 ${session.maxDiagnosticTurns || 10} 轮；追问与提示分别记录，达到上限后保留不确定结论。`;
  const budgetNames = {modelCalls:'已调用模型次数',reservedTokens:'已预留用量',reportedTokens:'模型报告用量'};
  const reviewLink = `${location.origin}${location.pathname}?review=${encodeURIComponent(session.id)}`;
  return `<details id="researchDetails" class="research-details"><summary>研究详情与运行记录</summary><p>提问方式：${esc(session.strategy === 'fixed' || run.strategy === 'fixed' ? '固定顺序' : '根据回答选择追问')} · 学习者代号：${esc(session.participantId || '未填写')}<br>会话：${esc(session.id)} · 版本：${esc(session.revision ?? '—')}</p><p>${esc(budgetDescription)}</p><div class="run-budget">${Object.entries(budget).filter(([key,value])=>key !== 'description' && ['number','string'].includes(typeof value)).map(([key,value])=>`<span>${esc(budgetNames[key] || key)}：${esc(value)}</span>`).join('')}</div><p class="field-hint">状态估计与原话证据用于研究对照。受助回答不作为独立通过的证据，证据分尚未经过真实学生数据标定。</p><label class="review-link">独立标注直达链接（同一服务内打开）<input readonly aria-label="独立标注直达链接" value="${esc(reviewLink)}"></label><p>另一位标注者可以直接打开链接，仅查看学生回答和评分标准，不预先加载自动结果。</p><ol class="trace-list">${trace.length ? trace.map(t=>`<li><strong>${esc(traceLabel(t.event))}</strong><span>${esc(detailText(t.detail))}</span>${t.timestamp ? `<time>${esc(new Date(t.timestamp).toLocaleTimeString('zh-CN'))}</time>`:''}</li>`).join(''):'<li>当前还没有运行记录。</li>'}</ol></details>`;
}
function traceLabel(event) {return ({plan:'规划',planned:'规划',assessment:'评估回答',assessed:'评估回答',evaluate:'评估回答',select:'选择问题',task_selected:'选择问题',record:'保存记录',recorded:'保存记录',pause:'等待回答',paused:'等待回答',hint:'提供帮助',help_provided:'提供帮助',support:'提供帮助',checkpoint:'保存进度',resume:'恢复会话',run_started:'启动本轮任务',run_resumed:'恢复本轮任务',run_failed:'任务暂停，等待重试',before_model:'准备模型调用',after_model:'模型返回',before_tool:'准备执行工具',after_tool:'工具已完成',memory_loaded:'读取学习记录',context_compacted:'整理较早对话',budget:'检查轮次预算'})[event] || event;}
function detailText(value) {return typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);}
function conceptCardsHtml() {
  return (session.concepts || []).map(c=>{
    const checking = ['delayed','retention'].includes(session.phase) || session.phase === 'posttest' && c.id === session.activeConcept;
    let detail = session.phase === 'diagnostic' ? `已收集 ${esc(c.evidenceCount || 0)} 轮回答` : checking ? '独立验证中，整组完成后展示更新' : `${esc(statuses[c.status] || c.status)}<br>${c.score == null ? '暂无可评分证据' : `本阶段证据分 ${esc(c.score)}/100`}<br>本阶段独立证据 ${esc(c.independentCount || 0)} 条 · 历史共 ${esc(c.evidenceCount || 0)} 条<br>${esc(c.reliability || '')}`;
    return `<article class="concept-evidence ${session.phase === 'diagnostic' || checking ? '' : esc(c.status)}"><strong>${esc(c.label)}</strong><small>${detail}</small></article>`;
  }).join('');
}
function transcriptHtml(turns,current) {
  const reveal = !['diagnostic','delayed','retention'].includes(session.phase);
  const history = turns.map(t=>{
    const testing = session.phase === 'posttest' && t.task.phase === 'posttest' && t.task.conceptId === session.activeConcept;
    return `<div class="turn"><div class="message teacher"><span class="speaker">${esc(isIndependentPhase(t.task.phase) ? '独立验证' : '诊断提问')} · ${esc(t.turnId)}</span>${esc(t.task.prompt)}</div>${supportHtml(t.task,t)}<div class="message student"><span class="speaker">你的回答</span>${esc(t.answer)}</div>${reveal && !testing ? evidenceHtml(t):''}</div>`;
  }).join('');
  if (!current) return history;
  const hints = session.phase === 'diagnostic' ? `<details id="helpOptions"><summary>需要一点帮助？</summary><p class="field-hint">可以按需选择帮助；使用的最高帮助等级会记入本次回答。</p><div class="hint-actions">${[1,2,3].map(level=>`<button class="secondary-button" data-hint="${level}" data-locked="${supportOf(current).level >= level}" ${supportOf(current).level >= level ? 'disabled':''}>${level === 1 ? '1 · 给个方向' : level === 2 ? '2 · 分步引导' : '3 · 看一个示范'}</button>`).join('')}</div></details>`:'';
  return `${history}<div id="currentQuestion" class="message teacher current"><span class="speaker">${isIndependentPhase(session.phase) ? '独立验证 · 本轮不提供提示' : '下一步验证'} · ${esc(current.kind === 'transfer' ? '迁移情境' : current.kind === 'probe' ? '补充追问' : '解释依据')}</span>${esc(current.prompt)}</div><section class="support-panel">${supportHtml(current)}${hints}</section>`;
}
function render() {
  review = null;
  $('blindReview').hidden = true; $('blindReview').replaceChildren();
  $('welcome').hidden = true; $('workspace').hidden = false;
  const turns = session.turns || [], diagnostic = turns.filter(t=>t.task.phase === 'diagnostic').length;
  const current = session.legacy ? null : session.currentTask;
  const previousDraft = $('studentAnswer')?.value;
  const sameTask = $('answerForm')?.dataset.task === current?.id;
  const researchOpen = $('researchDetails')?.open;
  const reviewAllowed = session.phase === 'diagnosed' && turns.length > 0;
  const composer = current ? `<form id="answerForm" data-task="${esc(current.id)}"><label for="studentAnswer">用自己的话回答，也请说明理由</label><textarea id="studentAnswer" maxlength="3000" minlength="2" required rows="5" placeholder="写下判断和依据；也可以直接说不知道。"></textarea><div class="composer-footer"><span id="answerStatus" role="status"></span><button id="sendAnswer" class="primary-button" type="submit">提交回答 →</button></div></form>`:'';
  $('workspace').innerHTML = `<div class="dialogue-heading"><div><p class="eyebrow">过拟合与泛化 · ${esc((session.concepts || []).length)} 项能力</p><h2>${esc(phaseLabel(session.phase))}</h2><p class="field-hint">诊断 ${diagnostic}/${session.maxDiagnosticTurns || 10} 轮 · ${session.provider === 'offline-rules' ? '离线规则体验' : '模型评估'} · 记录保存在本机</p></div><div class="toolbar"><button id="exportSession" class="secondary-button">导出完整记录</button><button id="openReview" class="secondary-button" ${reviewAllowed ? '' : 'disabled'} data-locked="${!reviewAllowed}">独立人工标注</button><button id="refreshSession" class="text-button">刷新会话</button><button id="newSession" class="text-button">新建诊断</button></div></div>${session.legacy ? '<p class="notice">这是旧版会话，可查看、导出和标注。请新建诊断以体验五项能力与分级帮助。</p>':''}<div class="dialogue-layout"><aside class="dialogue-sidebar"><p class="eyebrow">理解证据</p><div id="conceptList">${conceptCardsHtml()}</div><p class="field-hint">解释与迁移分别验证。受助成功会保留，但独立新题通过后，才支持“本轮已验证”。</p></aside><div class="conversation-panel"><div id="transcript" class="transcript" aria-live="polite">${transcriptHtml(turns,current)}</div>${composer}<section id="lesson"></section><section id="result"></section>${researchHtml()}</div></div>`;
  if (researchOpen) $('researchDetails').open = true;
  if (current) {
    const draft = readJson(draftKey);
    $('studentAnswer').value = pendingForCurrentTask()?.answer || (sameTask ? previousDraft : draft?.sessionId === session.id && draft?.taskId === current.id ? draft.answer : '') || '';
    $('studentAnswer').oninput = () => writeStorage(draftKey,JSON.stringify({sessionId:session.id,taskId:current.id,answer:$('studentAnswer').value}));
    $('answerForm').onsubmit = e => {
      e.preventDefault();
      if (busy) return;
      let pending = pendingForCurrentTask();
      if (!pending) {
        const answer = $('studentAnswer').value.trim();
        if (answer.length < 2) {showError('请至少写下两个有效字符，也可以回答“不知道”。'); $('studentAnswer').focus(); return;}
        pending = {sessionId:session.id,taskId:current.id,answer,requestId:crypto.randomUUID()}; savePending(pending);
      }
      perform('answer',{taskId:pending.taskId,answer:pending.answer,requestId:pending.requestId});
    };
  }
  if (session.phase === 'learning' && !session.legacy) renderLesson();
  if (['diagnosed','completed'].includes(session.phase)) renderResult();
  $('exportSession').onclick = () => window.location.assign(`/api/dialogue/sessions/${encodeURIComponent(session.id)}/export`);
  $('refreshSession').onclick = () => perform('');
  $('newSession').onclick = () => {if (busy) return; $('workspace').hidden = true; $('welcome').hidden = false; showError('');};
  $('openReview').onclick = () => enterReview();
  document.querySelectorAll('[data-hint]').forEach(button=>button.onclick=()=>perform('hint',{taskId:current.id,level:Number(button.dataset.hint)}));
  setBusy(busy);
  if (isRunBlocked()) showError(blockedMessage());
  if (current) $('currentQuestion').scrollIntoView({behavior:'smooth',block:'center'});
  else if (session.phase === 'learning') $('lesson').scrollIntoView({behavior:'smooth',block:'start'});
  else if (session.phase === 'diagnosed') $('result').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderLesson() {
  const lesson = session.lessons?.[session.activeConcept];
  if (!lesson) return;
  $('lesson').innerHTML = `<article class="lesson-reading"><p class="eyebrow">补齐理解缺口</p><h3>${esc(lesson.title)}</h3><p>${esc(lesson.objective)}</p>${list(lesson.misconceptions).length ? `<blockquote>本次记录的误解：${esc(list(lesson.misconceptions).join('；'))}</blockquote>`:''}${list(lesson.sections).map(section=>`<h4>${esc(Array.isArray(section) ? section[0] : section.title)}</h4><p>${esc(Array.isArray(section) ? section[1] : section.text)}</p>`).join('')}<h4>把解释放进例子</h4><p>${esc(lesson.example)}</p><p>阅读不会提高证据分。接下来撤去提示，用新的解释题和迁移题独立验证。</p><button id="beginPosttest" class="primary-button">已读完，开始独立复测 →</button></article>`;
  $('beginPosttest').onclick = () => perform('posttest',{});
}
function renderResult() {
  const retentionStarted = !!session.retention?.startedAt;
  $('result').innerHTML = `<div class="result-intro"><h3>让判断有据可查</h3><p>展开回答下方的评估可查看原话依据。选择需要补齐的知识点，学习后再用新题独立验证。诊断前后的证据分别保留。</p>${retentionStarted ? '<p class="field-hint">延时检查已开始，新的补学请新建会话。</p>':''}</div><div class="result-actions">${[...(session.concepts || [])].sort((a,b)=>(a.status === 'verified')-(b.status === 'verified')).map(c=>{
    const learned = !!session.lessons?.[c.id] || session.legacy;
    const locked = learned || retentionStarted;
    const initial = (session.diagnosis || []).find(s=>s.conceptId === c.id);
    return `<article class="learning-card"><h3>${esc(c.label)} · ${esc(statuses[c.status] || c.status)}</h3><p>${esc(c.objective)}</p><p>初始诊断：${esc(statuses[initial?.status] || '尚未确认')}${learned ? ' · 本轮教学与复测已记录':''}</p><button class="${locked ? 'secondary':'primary'}-button" data-teach="${esc(c.id)}" data-locked="${locked}" ${locked ? 'disabled':''}>${learned ? '本轮已完成' : retentionStarted ? '补学请新建会话' : c.status === 'verified' ? '巩固并复测' : '针对性学习与复测'}</button></article>`;
  }).join('')}</div>${retentionHtml()}`;
  document.querySelectorAll('[data-teach]').forEach(button=>button.onclick=()=>perform('teach',{conceptId:button.dataset.teach}));
  if ($('beginDelayed')) $('beginDelayed').onclick=()=>perform('delayed',{});
}
function rubricHtml(rubric) {
  if (!rubric) return '';
  if (typeof rubric === 'string') return `<p>${esc(rubric)}</p>`;
  if (Array.isArray(rubric)) return `<ul>${rubric.map(item=>`<li>${esc(detailText(item))}</li>`).join('')}</ul>`;
  return `<dl>${Object.entries(rubric).map(([key,value])=>`<dt>${esc(labels[key] || key)}</dt><dd>${esc(Array.isArray(value) ? value.join('；') : detailText(value))}</dd>`).join('')}</dl>`;
}
async function enterReview(id = session?.id || savedId) {
  if (busy) return;
  setBusy(true); showError('');
  try {
    const data = await api('review',undefined,id);
    // Keep only the dedicated unscored review payload in this view. Removing
    // the regular workspace also prevents accidental exposure through its DOM.
    review = data; reviewDrafts = {}; session = null;
    $('welcome').hidden = true;
    $('workspace').replaceChildren(); $('workspace').hidden = true;
    $('blindReview').hidden = false;
    renderReview();
  } catch (error) {showError(error.message);}
  finally {setBusy(false);}
}
function renderReview() {
  $('blindReview').innerHTML = `<div class="dialogue-heading"><div><p class="eyebrow">独立人工标注</p><h2>先看学生证据，再给判断</h2><p class="field-hint">此页不展示自动判分、证据分或掌握状态。保存标签后，仍留在独立标注页。</p></div><button id="exitReview" class="secondary-button">退出标注，查看自动结果</button></div><label class="review-annotator">标注者代号 <input id="reviewAnnotator" maxlength="80" required placeholder="例如 teacher-01" autocomplete="off" value="${esc(readStorage('masterymap-annotator') || '')}"></label><div class="review-turns">${(review.turns || []).map(turn=>`<article class="review-card"><p class="eyebrow">第 ${esc(turn.turnId)} 轮 · ${esc(isIndependentPhase(turn.task.phase) ? '独立验证':'诊断')}</p><h3>${esc(turn.task.prompt)}</h3><p class="support-badge ${Number(turn.support?.level || turn.support?.hintLevel) ? 'assisted':''}">${Number(turn.support?.level || turn.support?.hintLevel) ? `使用 ${esc(turn.support.level || turn.support.hintLevel)} 级帮助`:'独立尝试 · 未记录提示'}</p>${list(turn.support?.hints || (turn.support?.text ? [turn.support] : [])).map(h=>`<blockquote>${esc(h.text || h)}</blockquote>`).join('')}<div class="review-answer">${esc(turn.answer)}</div><details class="review-rubric"><summary>查看该能力的评分标准</summary>${rubricHtml((review.concepts || []).find(c=>c.id === turn.task.conceptId)?.rubric)}</details><form class="annotation review-annotation" data-turn="${esc(turn.turnId)}"><label>本轮回答<select name="correctness" required><option value="">选择判分</option>${Object.entries(labels).map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join('')}</select></label><label>原话依据<input name="evidenceQuote" maxlength="1000" placeholder="引用支持判断的学生原话"></label><label>备注<input name="note" maxlength="1000" placeholder="判定理由或待核实之处"></label><button type="submit" class="secondary-button">保存本轮标签</button><span class="annotation-status" role="status"></span></form></article>`).join('')}</div><section class="review-mastery"><h3>综合当前证据，标注知识点状态</h3><p>请结合独立表现、帮助条件和新情境回答判断；证据不足时可以选择“尚未确认”。</p>${(review.concepts || []).map(c=>`<article class="review-card"><h4>${esc(c.label)}</h4><p>${esc(c.objective)}</p><form class="annotation review-mastery-form" data-concept="${esc(c.id)}"><label>掌握判断<select name="status" required><option value="">选择状态</option>${Object.entries(statuses).map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join('')}</select></label><label>备注<input name="note" maxlength="1000" placeholder="判断依据"></label><button type="submit" class="secondary-button">保存掌握标签</button><span class="annotation-status" role="status"></span></form></article>`).join('')}</section>`;
  $('reviewAnnotator').oninput = () => writeStorage('masterymap-annotator',$('reviewAnnotator').value);
  $('exitReview').onclick = async () => {
    if (busy) return;
    setBusy(true); showError('');
    try {acceptSession(await api('',undefined,review.sessionId)); history.replaceState(null,'',location.pathname); render();} catch (error) {showError(error.message);} finally {setBusy(false);}
  };
  document.querySelectorAll('.review-annotation').forEach(form=>form.onsubmit=e=>{
    e.preventDefault();
    const data = new FormData(form);
    saveReviewLabel(form,'annotations',{turnId:Number(form.dataset.turn),correctness:data.get('correctness'),evidenceQuote:data.get('evidenceQuote'),note:data.get('note')});
  });
  document.querySelectorAll('.review-mastery-form').forEach(form=>form.onsubmit=e=>{
    e.preventDefault(); const data = new FormData(form);
    saveReviewLabel(form,'mastery-annotations',{conceptId:form.dataset.concept,status:data.get('status'),note:data.get('note')});
  });
  document.querySelectorAll('.review-annotation,.review-mastery-form').forEach(form=>{
    const draft = reviewDrafts[form.dataset.turn ? `turn:${form.dataset.turn}` : `concept:${form.dataset.concept}`];
    if (!draft) return;
    Object.entries(draft.values).forEach(([name,value])=>{if (form.elements.namedItem(name)) form.elements.namedItem(name).value=value;});
    form.querySelector('.annotation-status').textContent = draft.saved;
  });
}
async function saveReviewLabel(form, action, body) {
  if (busy) return;
  const annotator = $('reviewAnnotator').value.trim();
  if (!annotator) {$('reviewAnnotator').reportValidity(); $('reviewAnnotator').focus(); return;}
  document.querySelectorAll('.review-annotation,.review-mastery-form').forEach(item=>{
    reviewDrafts[item.dataset.turn ? `turn:${item.dataset.turn}` : `concept:${item.dataset.concept}`] = {values:Object.fromEntries(new FormData(item)),saved:item.querySelector('.annotation-status').textContent};
  });
  setBusy(true); showError('');
  try {
    await api(action,{...body,annotator,blind:true,asOfTurnId:review.asOfTurnId},review.sessionId);
    form.querySelector('.annotation-status').textContent = '已保存人工标签';
    reviewDrafts[form.dataset.turn ? `turn:${form.dataset.turn}` : `concept:${form.dataset.concept}`].saved = '已保存人工标签';
    review = await api('review',undefined,review.sessionId);
    renderReview();
  } catch (error) {showError(error.message);} finally {setBusy(false);}
}
$('startForm').onsubmit = e => {e.preventDefault(); perform('create',{strategy:$('strategy').value,...($('participantId').value.trim() ? {participantId:$('participantId').value.trim()} : {})});};
$('resumeSession').onclick = () => perform('');
const directReviewId = new URLSearchParams(location.search).get('review');
if (directReviewId) enterReview(directReviewId);
