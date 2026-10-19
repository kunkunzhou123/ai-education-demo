const BUILTIN_PLAN = {
  topic: "传统机器学习",
  nodes: [
    { id: "foundations", parentId: null, label: "数学与统计基础", description: "理解概率、估计、优化为何支撑模型学习", importance: 5 },
    { id: "probability", parentId: "foundations", label: "概率与估计", description: "区分概率、似然与参数估计", importance: 5 },
    { id: "optimization", parentId: "foundations", label: "损失与优化", description: "理解损失函数、梯度与正则化", importance: 5 },

    { id: "supervised", parentId: null, label: "监督学习", description: "根据任务与数据选择回归或分类模型", importance: 5 },
    { id: "linear", parentId: "supervised", label: "线性与逻辑回归", description: "理解线性决策、概率输出与正则化", importance: 5 },
    { id: "trees", parentId: "supervised", label: "树模型与集成", description: "理解树、随机森林与 Boosting 的差别", importance: 5 },

    { id: "unsupervised", parentId: null, label: "无监督学习", description: "从无标签数据中发现结构和表示", importance: 4 },
    { id: "clustering", parentId: "unsupervised", label: "聚类", description: "根据簇形状和尺度选择聚类方法", importance: 4 },
    { id: "reduction", parentId: "unsupervised", label: "降维", description: "区分保留方差、流形与可视化目标", importance: 4 },

    { id: "evaluation", parentId: null, label: "评估与验证", description: "用无泄漏的实验估计泛化能力", importance: 5 },
    { id: "metrics", parentId: "evaluation", label: "指标选择", description: "按业务代价选择分类或回归指标", importance: 5 },
    { id: "validation", parentId: "evaluation", label: "交叉验证与泄漏", description: "正确划分数据并识别信息泄漏", importance: 5 },

    { id: "data", parentId: null, label: "数据与特征", description: "把原始数据转为可学习且不泄漏的表示", importance: 4 },
    { id: "preprocess", parentId: "data", label: "预处理", description: "处理缺失、类别、尺度与异常值", importance: 4 },
    { id: "features", parentId: "data", label: "特征工程", description: "构造有效特征并控制维度与泄漏", importance: 4 },

    { id: "generalization", parentId: null, label: "泛化与模型选择", description: "识别过拟合并控制模型复杂度", importance: 5 },
    { id: "biasvariance", parentId: "generalization", label: "偏差—方差", description: "诊断欠拟合、过拟合及其改进方向", importance: 5 },
    { id: "tuning", parentId: "generalization", label: "调参与选择", description: "在验证集上公平地选择模型与参数", importance: 4 }
  ],
  questions: [
    { id: "qf0", nodeId: "foundations", stage: "macro", level: 1, stem: "训练误差持续下降，但验证误差先下降后上升，最直接说明什么？", options: ["学习率一定太小", "模型开始过拟合", "数据必然存在标签错误", "特征必须标准化"], answer: 1, explanation: "训练集继续变好而验证集变差，是典型的泛化差距扩大。" },
    { id: "qs0", nodeId: "supervised", stage: "macro", level: 1, stem: "目标是预测客户下月是否流失，首先应把它视为什么任务？", options: ["回归", "聚类", "二分类", "降维"], answer: 2, explanation: "目标只有流失/不流失两类，属于二分类问题。" },
    { id: "qu0", nodeId: "unsupervised", stage: "macro", level: 1, stem: "一批用户没有标签，希望先发现自然形成的用户群，最合适的任务类型是？", options: ["聚类", "回归", "监督分类", "时间序列外推"], answer: 0, explanation: "没有标签、目标是发现群组结构，对应聚类。" },
    { id: "qe0", nodeId: "evaluation", stage: "macro", level: 1, stem: "正样本只有 1%，模型把所有样本预测为负类时准确率达到 99%。最合理的判断是？", options: ["模型已经很好", "准确率在此处具有误导性", "应删除正样本", "只需增加训练轮数"], answer: 1, explanation: "类别极不平衡时，高准确率可能来自完全忽略少数类。" },
    { id: "qd0", nodeId: "data", stage: "macro", level: 1, stem: "标准化器应在哪些数据上拟合均值和标准差？", options: ["训练集", "训练集和测试集", "仅测试集", "全部数据加未来样本"], answer: 0, explanation: "预处理参数只能从训练集学习，否则会把测试信息泄漏进训练流程。" },
    { id: "qg0", nodeId: "generalization", stage: "macro", level: 1, stem: "训练误差和验证误差都很高，而且二者很接近，模型更可能处于什么状态？", options: ["高方差", "数据泄漏", "高偏差", "完美泛化"], answer: 2, explanation: "训练集都拟合不好，通常意味着模型表达不足或特征不足，即高偏差。" },

    { id: "qprob", nodeId: "probability", stage: "micro", level: 2, stem: "在最大似然估计中，优化时被视为变量的通常是什么？", options: ["已经观测到的数据", "模型参数", "样本数量", "特征名称"], answer: 1, explanation: "数据已固定，最大似然通过调整模型参数使已观测数据更可能出现。" },
    { id: "qopt", nodeId: "optimization", stage: "micro", level: 2, stem: "L2 正则化加入损失函数后，主要会直接推动什么变化？", options: ["权重整体趋向较小", "训练样本数量增加", "标签自动平衡", "预测必然无偏"], answer: 0, explanation: "L2 对大权重施加平方惩罚，使参数倾向于更小、更平滑。" },
    { id: "qlin", nodeId: "linear", stage: "micro", level: 2, stem: "逻辑回归为什么适合二分类，而普通线性回归通常不适合直接输出类别概率？", options: ["逻辑回归不需要特征", "Sigmoid 将线性得分映射到 0 到 1", "线性回归不能训练", "逻辑回归总能拟合非线性边界"], answer: 1, explanation: "逻辑回归通过 Sigmoid 把线性组合转成合法概率。" },
    { id: "qtree", nodeId: "trees", stage: "micro", level: 2, stem: "随机森林相比单棵深树，主要通过什么降低方差？", options: ["只保留一个特征", "对多棵差异化树进行平均", "把标签连续化", "取消采样"], answer: 1, explanation: "Bootstrap 样本和随机特征产生差异化树，集成平均能够降低方差。" },
    { id: "qcluster", nodeId: "clustering", stage: "micro", level: 2, stem: "数据中簇呈弯月形且含噪声，为什么 K-means 可能不理想？", options: ["它只能处理文本", "它偏好近似球形、以均值为中心的簇", "它必须有标签", "它不能处理两个簇"], answer: 1, explanation: "K-means 的距离和质心假设更适合近似球形簇。" },
    { id: "qpca", nodeId: "reduction", stage: "micro", level: 2, stem: "PCA 的第一主成分选择了什么方向？", options: ["标签最准确的方向", "样本方差最大的正交方向", "均值最小的方向", "类别数量最多的方向"], answer: 1, explanation: "PCA 是无监督线性降维，寻找能够解释最大方差的方向。" },
    { id: "qmetric", nodeId: "metrics", stage: "micro", level: 2, stem: "癌症筛查中漏诊代价远高于误报，选择模型时通常应优先关注什么？", options: ["召回率", "训练准确率", "R²", "聚类轮廓系数"], answer: 0, explanation: "降低漏诊意味着尽可能找出真实阳性，应重点关注召回率。" },
    { id: "qvalid", nodeId: "validation", stage: "micro", level: 3, stem: "做 5 折交叉验证时，特征选择应如何处理？", options: ["先在全部数据上选特征", "在每个训练折内部重新选特征", "只在测试折选特征", "交叉验证不允许特征选择"], answer: 1, explanation: "特征选择也会学习数据，必须放在每个训练折内部，避免验证信息泄漏。" },
    { id: "qprep", nodeId: "preprocess", stage: "micro", level: 2, stem: "下列哪类模型通常最需要关注特征尺度差异？", options: ["基于距离的 KNN", "普通决策树", "随机森林中的单树", "规则列表"], answer: 0, explanation: "KNN 直接依赖距离，尺度大的特征可能不合理地主导距离。" },
    { id: "qfeature", nodeId: "features", stage: "micro", level: 3, stem: "预测用户是否会购买时，把“购买之后才产生的退款状态”作为特征，属于什么问题？", options: ["类别不平衡", "目标泄漏", "欠拟合", "无监督预训练"], answer: 1, explanation: "该特征在预测时不可获得，并包含结果发生后的信息，属于目标泄漏。" },
    { id: "qbv", nodeId: "biasvariance", stage: "micro", level: 2, stem: "模型在不同训练子集上的预测变化很大，但每次都能把训练集拟合得很好，主要问题是什么？", options: ["高偏差", "高方差", "低维度", "指标无定义"], answer: 1, explanation: "对训练数据扰动敏感且训练拟合很好，是高方差的典型表现。" },
    { id: "qtune", nodeId: "tuning", stage: "micro", level: 3, stem: "使用验证集反复调参后，最终性能应当在哪里做一次独立评估？", options: ["同一个验证集", "训练集", "从未参与选择的测试集", "任意一折训练数据"], answer: 2, explanation: "验证集已参与模型选择，最终需要未参与选择的测试集估计泛化性能。" }
  ]
};

const state = {
  plan: null,
  phase: "setup",
  queue: [],
  index: 0,
  selectedAnswer: null,
  confidence: 3,
  answered: false,
  attempts: [],
  macroResults: new Map()
};

const $ = id => document.getElementById(id);
const escapeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const views = { setup: $("setupView"), diagnose: $("diagnoseView"), result: $("resultView") };

function setView(name) {
  Object.entries(views).forEach(([key, el]) => { el.hidden = key !== name; });
  document.querySelectorAll("[data-stage]").forEach(el => {
    const order = { setup: 0, diagnose: 1, result: 2 };
    el.classList.toggle("active", order[el.dataset.stage] <= order[name]);
  });
  $("restartTop").hidden = name === "setup";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function roots() { return state.plan.nodes.filter(node => !node.parentId); }
function children(id) { return state.plan.nodes.filter(node => node.parentId === id); }
function nodeById(id) { return state.plan.nodes.find(node => node.id === id); }

async function begin(topic) {
  const hint = $("topicHint");
  hint.classList.remove("error");
  if (topic.trim() === "传统机器学习") {
    startPlan(structuredClone(BUILTIN_PLAN));
    return;
  }

  hint.textContent = "正在生成领域知识树和诊断问题…";
  const button = $("topicForm").querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const response = await fetch("/api/generate-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic })
    });
    const plan = await response.json();
    if (!response.ok) throw new Error(plan.error || "生成失败");
    startPlan(plan);
  } catch (error) {
    hint.textContent = error.message;
    hint.classList.add("error");
  } finally {
    button.disabled = false;
  }
}

function startPlan(plan) {
  learning = { records: {}, lessons: {}, reviewAttempts: [] };
  lessonPanel.hidden = true;
  activeLesson = null;
  state.plan = plan;
  state.phase = "macro";
  state.queue = roots().map(root => state.plan.questions.find(q => q.nodeId === root.id && q.stage === "macro")).filter(Boolean);
  state.index = 0;
  state.selectedAnswer = null;
  state.confidence = 3;
  state.answered = false;
  state.attempts = [];
  state.macroResults = new Map();
  $("diagnoseTopic").textContent = plan.topic;
  setView("diagnose");
  renderQuestion();
}

function currentQuestion() { return state.queue[state.index]; }

function renderQuestion() {
  const q = currentQuestion();
  if (!q) return finishPhase();
  const node = nodeById(q.nodeId);
  state.selectedAnswer = null;
  state.confidence = 3;
  state.answered = false;
  $("feedback").hidden = true;
  $("submitAnswer").disabled = true;
  $("submitAnswer").textContent = "提交答案";
  $("phaseLabel").textContent = state.phase === "macro" ? "宏观筛查" : "薄弱分支下钻";
  $("questionStage").textContent = state.phase === "macro" ? "宏观题" : "微观验证";
  $("questionNode").textContent = node?.label || "知识点";
  $("questionStem").textContent = q.stem;
  $("progressCount").textContent = `${state.index + 1} / ${state.queue.length}`;
  $("progressBar").style.width = `${((state.index + 1) / state.queue.length) * 100}%`;

  const keys = ["A", "B", "C", "D", "E"];
  $("options").innerHTML = q.options.map((option, index) => `
    <button type="button" class="option" data-answer="${index}" role="radio" aria-checked="false">
      <span class="option-key">${keys[index]}</span><span>${escapeText(option)}</span>
    </button>`).join("");
  $("options").querySelectorAll(".option").forEach(button => {
    button.addEventListener("click", () => selectAnswer(Number(button.dataset.answer)));
  });
  $("confidenceButtons").querySelectorAll("button").forEach(button => {
    button.classList.toggle("selected", Number(button.dataset.confidence) === 3);
  });
  renderTrail(q.nodeId);
}

function selectAnswer(index) {
  if (state.answered) return;
  state.selectedAnswer = index;
  $("options").querySelectorAll(".option").forEach((button, i) => {
    button.classList.toggle("selected", i === index);
    button.setAttribute("aria-checked", String(i === index));
  });
  $("submitAnswer").disabled = false;
}

function renderTrail(currentNodeId) {
  const rootItems = roots().map(root => {
    const result = state.macroResults.get(root.id);
    const current = root.id === currentNodeId || children(root.id).some(child => child.id === currentNodeId);
    const suffix = result ? (result.needsDrill ? " · 待下钻" : " · 初步通过") : "";
    return `<div class="trail-item ${current ? "current" : ""}">${escapeText(root.label)}${suffix}</div>`;
  });
  $("branchTrail").innerHTML = rootItems.join("");
}

function scoreAttempt(correct, confidence) {
  return correct ? .65 : .2;
}

function submitCurrent() {
  if (state.answered) {
    state.index += 1;
    renderQuestion();
    return;
  }
  const q = currentQuestion();
  if (state.selectedAnswer === null) return;
  const correct = state.selectedAnswer === q.answer;
  const attempt = {
    questionId: q.id,
    nodeId: q.nodeId,
    stage: q.stage,
    correct,
    confidence: state.confidence,
    score: scoreAttempt(correct, state.confidence),
    selected: state.selectedAnswer,
    answer: q.answer,
    answeredAt: new Date().toISOString()
  };
  state.attempts.push(attempt);
  if (q.stage === "macro") {
    state.macroResults.set(q.nodeId, { ...attempt, needsDrill: !correct || state.confidence < 3 });
  }
  state.answered = true;
  $("options").querySelectorAll(".option").forEach((button, index) => {
    button.classList.remove("selected");
    if (index === q.answer) button.classList.add("correct");
    if (index === state.selectedAnswer && !correct) button.classList.add("wrong");
    button.disabled = true;
  });
  const feedback = $("feedback");
  feedback.hidden = false;
  feedback.classList.toggle("bad", !correct);
  feedback.innerHTML = `<strong>${correct ? "判断正确" : "这里暴露了一个值得下钻的点"}</strong><br>${escapeText(q.explanation)}`;
  $("submitAnswer").textContent = state.index === state.queue.length - 1 ? (state.phase === "macro" ? "进入薄弱分支" : "生成学习地图") : "下一题";
}

function finishPhase() {
  if (state.phase === "macro") {
    let weakRoots = roots().filter(root => state.macroResults.get(root.id)?.needsDrill);
    if (!weakRoots.length) {
      weakRoots = [...roots()].sort((a, b) => (state.macroResults.get(a.id)?.score || 0) - (state.macroResults.get(b.id)?.score || 0)).slice(0, 2);
    }
    const childIds = new Set(weakRoots.flatMap(root => children(root.id).map(child => child.id)));
    state.queue = state.plan.questions.filter(q => q.stage === "micro" && childIds.has(q.nodeId));
    state.phase = "micro";
    state.index = 0;
    if (!state.queue.length) return showResults();
    renderQuestion();
  } else {
    showResults();
  }
}

function nodeScore(node) {
  const own = [...state.attempts, ...(learning.reviewAttempts || [])].filter(a => a.nodeId === node.id);
  if (own.length) return own.reduce((sum, a) => sum + a.score, 0) / own.length;
  const childScores = children(node.id).map(nodeScore).filter(value => value !== null);
  return childScores.length ? childScores.reduce((a, b) => a + b, 0) / childScores.length : null;
}

function finalRootScore(root) {
  const own = [...state.attempts, ...(learning.reviewAttempts || [])].filter(a=>a.nodeId === root.id);
  const macro = own.length ? own.reduce((sum,a)=>sum+a.score,0)/own.length : null;
  const assessedChildren = children(root.id).map(nodeScore).filter(value => value !== null);
  if (!assessedChildren.length) return macro;
  const micro = assessedChildren.reduce((a, b) => a + b, 0) / assessedChildren.length;
  return macro === null ? micro : macro * .4 + micro * .6;
}

function statusFor(score) {
  if (score === null) return "unknown";
  if (score >= .78) return "mastered";
  if (score >= .5) return "learning";
  return "weak";
}

function showResults() {
  setView("result");
  $("resultTitle").textContent = `你的“${state.plan.topic}”学习地图`;
  const rootScores = roots().map(root => ({ node: root, score: finalRootScore(root) })).filter(item => item.score !== null);
  const overall = rootScores.length ? Math.round(rootScores.reduce((sum, item) => sum + item.score, 0) / rootScores.length * 100) : 0;
  const weakCount = rootScores.filter(item => item.score < .5).length;
  const learningCount = rootScores.filter(item => item.score >= .5 && item.score < .78).length;
  $("overallMastery").textContent = `${overall}%`;
  $("masteryRing").style.setProperty("--value", `${overall}%`);
  $("resultSummary").textContent = `完成 ${state.attempts.length} 道自适应问题，定位到 ${weakCount} 个薄弱主干和 ${learningCount} 个待巩固主干。`;

  $("knowledgeMap").innerHTML = roots().map(root => {
    const rootScore = finalRootScore(root);
    return `<div class="map-branch">
      ${nodeCard(root, rootScore)}
      <div class="child-nodes">${children(root.id).map(child => nodeCard(child, nodeScore(child))).join("")}</div>
    </div>`;
  }).join("");

  const priority = collectPriorityNodes();
  const first = priority[0];
  $("priorityTitle").textContent = first ? `先补：${first.node.label}` : "主干掌握稳定";
  $("priorityText").textContent = first
    ? `${first.node.description}。该节点会影响后续相关模型的理解，建议先用概念辨析和一个反例把边界建立清楚。`
    : "宏观主干与抽查的细分节点表现稳定，可以进入综合案例和迁移练习。";

  const wrongAttempts = state.attempts.filter(a => !a.correct).slice(0, 3);
  $("evidenceList").innerHTML = wrongAttempts.length
    ? wrongAttempts.map(a => `<div class="evidence"><strong>${escapeText(nodeById(a.nodeId)?.label || "知识点")}</strong><br>回答错误，信心 ${a.confidence}/4，说明需要重新建立判断依据。</div>`).join("")
    : `<div class="evidence"><strong>高置信正确</strong><br>本轮未出现明确错误；地图保留未深入节点，避免把“没有考到”误判为“已掌握”。</div>`;

  const pathNodes = priority.length ? priority.slice(0, 6) : roots().slice(0, 3).map(node => ({ node, score: finalRootScore(node) }));
  $("learningPath").innerHTML = pathNodes.map((item, index) => {
    const type = item.score !== null && item.score < .5 ? "补基础" : item.score === null ? "做验证" : "强化迁移";
    const action = item.score === null
      ? "先做一道概念题和一道应用题，确认是否真的掌握。"
      : item.score < .5
        ? "先复述核心概念，再用反例辨析边界，最后完成一道基础应用题。"
        : "完成方法对比题和小型案例，把零散理解连接成可迁移能力。";
    return `<article class="path-step"><strong>${escapeText(item.node.label)}</strong><p>${action}</p><span>${type} · 建议 ${index < 2 ? "30" : "45"} 分钟</span><p><button class="primary-button" data-learn="${escapeText(encodeURIComponent(item.node.id))}">开始学习</button></p></article>`;
  }).join("");
  saveLearning();
}

function nodeCard(node, score) {
  const evidenceCount = [...state.attempts,...(learning.reviewAttempts || [])].filter(a=>a.nodeId === node.id).length;
  const fullyCovered = children(node.id).every(child => nodeScore(child) !== null);
  const status = score >= .78 && (evidenceCount < 2 || !fullyCovered) ? 'learning' : statusFor(score);
  const label = score === null ? "未测" : `${Math.round(score * 100)}%`;
  return `<div class="map-node ${status}" data-score="${label}"><strong>${escapeText(node.label)}</strong><small>${escapeText(node.description)}</small><button class="text-button" data-learn="${escapeText(encodeURIComponent(node.id))}">学习 / 复测</button></div>`;
}

function collectPriorityNodes() {
  const items = state.plan.nodes.map(node => ({ node, score: node.parentId ? nodeScore(node) : finalRootScore(node) }));
  return items
    .filter(item => item.score === null || item.score < .78)
    .sort((a, b) => {
      const unknownA = a.score === null ? .55 : a.score;
      const unknownB = b.score === null ? .55 : b.score;
      if (unknownA !== unknownB) return unknownA - unknownB;
      return (b.node.importance || 3) - (a.node.importance || 3);
    });
}

function reset() {
  state.plan = null;
  state.phase = "setup";
  $("topicHint").textContent = "“传统机器学习”可直接离线体验；其他主题会调用已配置的 DeepSeek。";
  $("topicHint").classList.remove("error");
  setView("setup");
}

$("topicForm").addEventListener("submit", event => {
  event.preventDefault();
  const topic = $("topicInput").value.trim();
  if (topic) begin(topic);
});
document.querySelectorAll("[data-topic]").forEach(button => button.addEventListener("click", () => {
  $("topicInput").value = button.dataset.topic;
}));
$("confidenceButtons").addEventListener("click", event => {
  const button = event.target.closest("button[data-confidence]");
  if (!button || state.answered) return;
  state.confidence = Number(button.dataset.confidence);
  $("confidenceButtons").querySelectorAll("button").forEach(item => item.classList.toggle("selected", item === button));
});
$("submitAnswer").addEventListener("click", submitCurrent);
$("quitDiagnosis").addEventListener("click", reset);
$("restartResult").addEventListener("click", reset);
$("restartTop").addEventListener("click", reset);

let learning = { records: {}, lessons: {}, reviewAttempts: [] };
let activeLesson = null;
const lessonPanel = document.createElement('section');
lessonPanel.id = 'lessonPanel';
lessonPanel.className = 'path-panel lesson-panel';
lessonPanel.hidden = true;
$('resultView').append(lessonPanel);

function saveLearning() {
  try { localStorage.setItem('masterymap-learning-v2', JSON.stringify({ plan: state.plan, attempts: state.attempts, macroResults: [...state.macroResults], learning })); } catch {}
}

async function openLesson(id, regenerate = false) {
  const node = nodeById(id);
  if (!node) return;
  activeLesson = id;
  lessonPanel.hidden = false;
  lessonPanel.innerHTML = '<h2>正在为你编写微课程…</h2><p>结合诊断错因，生成讲解、完整例题、自练题和两道新复测题。通常需要半分钟至一分钟。</p>';
  lessonPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    if (!learning.lessons[id] || regenerate) {
      const evidence = [...state.attempts,...(learning.reviewAttempts || [])].filter(a => a.nodeId === id || a.nodeId === node.parentId || children(id).some(c=>c.id === a.nodeId)).map(a => ({ ...a, question: a.question || state.plan.questions.find(q => q.id === a.questionId) }));
      const response = await fetch('/api/lesson', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: state.plan.topic, node, evidence, previousReview: learning.records[id] || null, previousQuestions: learning.lessons[id]?.quiz || [] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '生成失败');
      learning.lessons[id] = data;
      if (regenerate && learning.records[id]) learning.records[id].needsNew = true;
      saveLearning();
    }
    if (activeLesson === id) renderLesson(id);
  } catch (error) {
    lessonPanel.innerHTML = `<h2>暂时未能生成课程</h2><p>${escapeText(error.message)}</p><button class="primary-button" data-learn="${encodeURIComponent(id)}">重试</button>`;
  }
}

function renderLesson(id) {
  const lesson = learning.lessons[id];
  const prior = learning.records[id];
  lessonPanel.innerHTML = `
    <p class="eyebrow">针对你的诊断生成 · 可直接阅读的微课程</p>
    <h2>${escapeText(lesson.title)}</h2><p>${escapeText(lesson.objective)}</p>
    ${prior ? `<p class="review-status">上次复测：${prior.correct}/2。${prior.correct === 2 ? '本轮验证通过，可进入下一节点；可另生成新题巩固。' : '尚未通过，重点重读错题相关概念，然后换题验证。'}</p>` : ''}
    ${lesson.sections.map(s => `<article><h3>${escapeText(s.heading)}</h3><p class="lesson-prose">${escapeText(s.body)}</p></article>`).join('')}
    <article class="worked-example"><h3>一步步做例题</h3><p>${escapeText(lesson.example.problem)}</p><ol>${lesson.example.steps.map(s => `<li>${escapeText(s)}</li>`).join('')}</ol><p><strong>${escapeText(lesson.example.answer)}</strong></p></article>
    <h3>自己先试一题</h3><p>${escapeText(lesson.practice.question)}</p><details><summary>查看自练解析</summary><p class="lesson-prose">${escapeText(lesson.practice.answer)}</p></details>
    <button id="downloadLesson" class="secondary-button">下载文字讲义</button>
    <h3>学完后用新题验证</h3><p>两题全部答对才记为本轮通过。看完资料本身不会增加掌握度；分数是演示性证据分，不能代表长期掌握概率。</p>
    <form id="lessonQuiz">${lesson.quiz.map((q, i) => `<fieldset><legend>${i + 1}. ${escapeText(q.stem)}</legend>${q.options.map((o, j) => `<label class="quiz-choice"><input type="radio" name="review-${i}" value="${j}" required> ${escapeText(o)}</label>`).join('')}</fieldset>`).join('')}<button class="primary-button" ${prior && !prior.needsNew ? 'disabled' : ''}>提交复测并更新地图</button></form>
    <div id="reviewFeedback" aria-live="polite"></div><p><button id="newLesson" class="secondary-button">换个例子讲解，并生成新复测题</button></p>`;
  $('downloadLesson').onclick = () => {
    const text = [lesson.title, lesson.objective, ...lesson.sections.map(s => s.heading + '\n' + s.body), '例题\n' + lesson.example.problem, ...lesson.example.steps, lesson.example.answer, '练习\n' + lesson.practice.question, '解析\n' + lesson.practice.answer].join('\n\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = '学习讲义.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $('newLesson').onclick = () => openLesson(id, true);
  $('lessonQuiz').onsubmit = event => {
    event.preventDefault();
    const answers = new FormData(event.target);
    const correct = lesson.quiz.filter((q, i) => Number(answers.get('review-' + i)) === q.answer).length;
    if (learning.records[id] && !learning.records[id].needsNew) return;
    learning.reviewAttempts ||= [];
    lesson.quiz.forEach((q,i)=>{ const selected=Number(answers.get('review-'+i)); learning.reviewAttempts.push({nodeId:id,stage:'posttest',correct:selected===q.answer,score:selected===q.answer ? .85 : .2,selected,answer:q.answer,question:q,answeredAt:new Date().toISOString()}); });
    learning.records[id] = { score: correct === 2 ? .85 : correct === 1 ? .6 : .3, correct, reviewedAt: new Date().toISOString(), needsNew: false, errors: lesson.quiz.filter((q, i) => Number(answers.get('review-' + i)) !== q.answer).map(q => ({ stem: q.stem, chosen: q.options[Number(answers.get('review-' + lesson.quiz.indexOf(q)))], explanation: q.explanation })) };
    event.target.querySelector('button').disabled = true;
    showResults();
    $('reviewFeedback').innerHTML = `<h3>${correct === 2 ? '本轮通过，地图与后续路径已更新' : '尚需巩固，已记录错因'}</h3><p>${correct}/2 题正确。${correct === 2 ? '可以返回地图选择下一节点。' : '点击下方按钮，生成针对本次错因的补充讲解和新题。'}</p>${lesson.quiz.map((q, i) => `<p>${i + 1}. 正确答案：${escapeText(q.options[q.answer])}。${escapeText(q.explanation)}</p>`).join('')}`;
    $('reviewFeedback').scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-learn]');
  if (button) openLesson(decodeURIComponent(button.dataset.learn));
});

try {
  const saved = JSON.parse(localStorage.getItem('masterymap-learning-v2'));
  if (saved?.plan && saved?.learning) {
    const resume = document.createElement('button'); resume.className = 'secondary-button'; resume.type = 'button'; resume.textContent = '继续上次学习：' + saved.plan.topic;
    $('topicForm').append(resume);
    resume.onclick = () => {
      state.plan = saved.plan; state.attempts = saved.attempts.map(a=>({...a,score:scoreAttempt(a.correct,a.confidence)})); state.macroResults = new Map(saved.macroResults.map(([id,a])=>[id,{...a,score:scoreAttempt(a.correct,a.confidence)}])); learning = saved.learning;
      if (!learning.reviewAttempts) learning.reviewAttempts = Object.entries(learning.records).flatMap(([nodeId,r])=>Array.from({length:2},(_,i)=>({nodeId,stage:'posttest',correct:i<r.correct,score:i<r.correct ? .85 : .2,answeredAt:r.reviewedAt,legacy:true})));
      showResults();
    };
  }
} catch {}
