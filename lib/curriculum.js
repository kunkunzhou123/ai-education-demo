'use strict';

// Versioned, reviewed task forms. These are demonstration rubrics, not calibrated tests.
const VERSION = 'overfitting-v2.0.0';
const CONCEPTS = [
  {
    id: 'gap', label: '泛化差距',
    objective: '比较训练与独立验证表现，提出有条件的过拟合或欠拟合诊断。',
    prerequisites: [],
    rubric: {
      full: ['比较训练与未见数据表现', '区分差距与绝对性能', '检查划分、分布和合理基准'],
      partial: ['能指出差距，但缺少诊断条件或依据'],
      misconceptions: ['仅凭训练高分断言过拟合', '仅凭准确率60%断言欠拟合', '认为差距小就一定表现好']
    }
  },
  {
    id: 'complexity', label: '复杂度与噪声',
    objective: '解释有限样本、高复杂度和噪声记忆为何可能损害泛化。',
    prerequisites: ['gap'],
    rubric: {
      full: ['连接模型复杂度、有限数据与偶然细节', '解释噪声规律不能稳定迁移', '区分重复样本与新增信息'],
      partial: ['能说出过拟合，但缺少原因链条'],
      misconceptions: ['认为复制旧样本等同于获得独立新样本', '认为拟合随机标签证明学到了可靠规律']
    }
  },
  {
    id: 'early_stopping', label: '早停',
    objective: '用验证趋势选择训练检查点，并区分模型选择与最终测试。',
    prerequisites: ['gap'],
    rubric: {
      full: ['依据验证表现选择检查点', '说明继续降低训练误差未必改善泛化', '保留独立测试集'],
      partial: ['知道停止训练，但选择依据不清楚'],
      misconceptions: ['认为增加训练轮数必然改善泛化', '只选训练误差最低的检查点']
    }
  },
  {
    id: 'regularization', label: '正则化',
    objective: '说明正则化如何限制拟合噪声，并用验证集平衡正则强度与欠拟合。',
    prerequisites: ['complexity'],
    rubric: {
      full: ['解释限制有效复杂度或参数', '允许训练拟合变差而泛化改善', '指出过强正则可能欠拟合并用验证集比较'],
      partial: ['知道正则化可尝试，但缺少机制或强度权衡'],
      misconceptions: ['认为正则化越强越好', '认为训练误差上升必然意味着泛化更差']
    }
  },
  {
    id: 'validation', label: '数据划分',
    objective: '区分训练、验证和测试职责，并避免调参、预处理和实体重复造成泄漏。',
    prerequisites: ['gap'],
    rubric: {
      full: ['训练集拟合模型与预处理参数', '验证集用于选择超参数', '独立测试集只评估最终方案', '按部署场景划分实体或时间'],
      partial: ['能区分验证和测试，但遗漏选择偏差或预处理泄漏'],
      misconceptions: ['反复根据测试集调参仍声称测试独立', '先在全部数据拟合预处理再划分', '同一对象的近重复记录跨集合']
    }
  }
];

function task(id, conceptId, kind, phase, prompt, criteria, misconceptions = [], difficulty = 2) {
  return { id, conceptId, kind, phase, prompt, criteria, misconceptions,
    hintLevel: 0, difficulty, form: { diagnostic: 'A', posttest: 'B', delayed: 'C' }[phase] };
}
const criterion = (label, pattern) => ({ label, pattern });
const mistake = (label, pattern) => ({ label, pattern });

const TASKS = [
  task('gap-explain', 'gap', 'explain', 'diagnostic',
    '同分布独立划分的分类任务中，训练准确率99%，验证准确率70%。你倾向于什么诊断？请解释依据，以及判断前还要检查的条件。',
    [criterion('指出泛化差距或过拟合证据', '过拟合|泛化.{0,10}(差|弱)|差距'), criterion('比较训练与验证表现', '(训练|99).*(验证|70)|(验证|70).*(训练|99)'), criterion('检查划分、分布、泄漏或指标基准', '划分|分布|独立|泄漏|基准|不平衡|代表性')],
    [mistake('仅凭训练高分断言过拟合', '(只凭|仅凭|只要).{0,8}训练.{0,10}(高|99).{0,10}(就是|一定|必然)过拟合')]),
  task('gap-transfer', 'gap', 'transfer', 'diagnostic',
    '新任务中，一个经审查且使用相同输入信息的可靠基线可达90%。你的模型训练/验证准确率为60%/59%。这更像什么问题？如果没有90%这个基准，你还需要了解什么？',
    [criterion('在给定基准下倾向欠拟合', '欠拟合|高偏差|能力不足'), criterion('说明两边都低或差距小', '(都|均|两边|两者).{0,8}(低|差)|差距.{0,6}(小|不大)|接近'), criterion('缺基准时需了解任务难度、类别或可达性能', '基准|难度|类别|不平衡|可达|随机|多数类')]),
  task('gap-probe', 'gap', 'explain', 'diagnostic',
    '有人只看到训练准确率99%就断言过拟合。你同意吗？还缺哪一种证据？请解释它为什么必要。',
    [criterion('不能仅凭训练分数断言', '不能|不够|不足|不同意|无法|不一定'), criterion('需要独立未见数据的表现', '验证|测试|未见|新数据')], [], 1),
  task('gap-post-explain', 'gap', 'explain', 'posttest',
    '语音分类器训练/验证准确率97%/71%；数据划分独立且同分布，可信基线达到88%。请区分训练拟合和泛化，提出诊断并说明为什么不能只看97%。',
    [criterion('指出过拟合或泛化差距', '过拟合|泛化差距|差距'), criterion('比较训练与未见数据', '训练.*(验证|未见)|(验证|未见).*训练'), criterion('说明单个训练指标不足', '不能|不足|只看|未见|独立')]),
  task('gap-post-transfer', 'gap', 'transfer', 'posttest',
    '医学分类器训练与验证准确率都是95%，但95%的样本本来就是阴性。能据此说模型已学好或存在过拟合吗？你会补充哪些证据？',
    [criterion('不凭两个高分断言', '不能|不足|无法|不一定'), criterion('检查类别不平衡与多数类基准', '不平衡|多数类|阴性|基准'), criterion('补充适当指标或独立检验', '召回|精确|混淆矩阵|灵敏|特异|独立|未见|分布')], [], 3),
  task('gap-delayed-explain', 'gap', 'explain', 'delayed',
    '延时检查：同分布独立划分下，模型训练误差2%、验证误差19%。请解释这两个量分别说明什么，并给出有条件的诊断。',
    [criterion('区分训练拟合与泛化', '训练.*(验证|泛化)|(验证|泛化).*训练'), criterion('指出差距及过拟合证据', '差距|过拟合'), criterion('诊断需结合基准或数据条件', '基准|划分|独立|分布|噪声|检查')]),
  task('gap-delayed-transfer', 'gap', 'transfer', 'delayed',
    '延时迁移：在一个可靠基线可达92%的任务上，新模型训练/验证准确率68%/67%。同事因分数接近就说模型很好。你如何回应？若去掉基线信息，结论有什么变化？',
    [criterion('给定基准下提示欠拟合', '欠拟合|高偏差|不足'), criterion('差距小不代表绝对性能好', '接近|差距小|都低|均低'), criterion('没有基准不能仅凭分数诊断', '基准|难度|可达|不能|不足')], [], 3),

  task('complexity-explain', 'complexity', 'explain', 'diagnostic',
    '一棵无限制的深树只用20个样本训练，训练几乎全对但新样本常错。请连接模型复杂度、数据量与噪声，解释可能的原因。',
    [criterion('模型复杂且样本有限', '复杂|深树|深度|样本.{0,5}(少|有限)|20'), criterion('记忆噪声或偶然细节', '噪声|偶然|记住|记忆'), criterion('这些细节未必迁移到新数据', '泛化|新样本|新数据|未见')]),
  task('complexity-transfer', 'complexity', 'transfer', 'diagnostic',
    '把这20个样本各复制100次，与新增2000个同分布、独立、有代表性的样本，是否提供相同的学习信息？哪一种更可能帮助泛化，为什么？',
    [criterion('区分重复与新增独立样本', '不同|不相同|不等|不能|新增|独立'), criterion('解释信息量或多样性差异', '信息|多样|重复|偶然'), criterion('新样本更可能帮助泛化而非保证', '新.{0,8}样本|新增|后者|代表性')],
    [mistake('复制旧样本等同于新信息', '(复制|重复).{0,12}(等同于|等于|一样多|相同的).{0,8}(新信息|独立样本|新样本)')]),
  task('complexity-probe', 'complexity', 'explain', 'diagnostic',
    '如果把训练标签随机打乱，复杂模型仍能在训练集上接近全对，这能证明它学到了可靠规律吗？请说出记忆与泛化的区别。',
    [criterion('不能视作可靠规律', '不能|无法|不代表|不是|不一定'), criterion('解释随机噪声可被记忆而不能稳定迁移', '随机|噪声|记忆|记住'), criterion('涉及新数据的表现', '泛化|新样本|新数据|未见')], [], 1),
  task('complexity-post-explain', 'complexity', 'explain', 'posttest',
    '一个高阶多项式穿过少量观测点，也追随了测量噪声。为什么这些点上的低误差不保证新测量上的低误差？请解释复杂度与样本量的作用。',
    [criterion('指出高复杂度与有限数据', '高阶|复杂|少量|样本'), criterion('拟合噪声或偶然变化', '噪声|偶然|记忆|记住'), criterion('不能保证泛化', '泛化|新测量|新数据|新样本')]),
  task('complexity-post-transfer', 'complexity', 'transfer', 'posttest',
    '图片模型在小样本上过拟合。方案A只是重复同一批图片，方案B收集覆盖不同光照、同分布的新图片。哪种更可能改善泛化？为什么也不能保证一定改善？',
    [criterion('选择有代表性的独立新数据', 'B|新图片|新样本|新数据|代表性'), criterion('解释新增信息或多样性', '信息|多样|重复|偶然'), criterion('效果仍需独立验证', '验证|不能保证|不保证|分布|质量')], [], 3),
  task('complexity-delayed-explain', 'complexity', 'explain', 'delayed',
    '延时检查：同样的数据上，更复杂的模型训练损失更低但验证损失更高。请解释它可能拟合了什么，以及为什么这不是可靠学习的充分证据。',
    [criterion('连接复杂度与训练拟合', '复杂|容量'), criterion('指出噪声或偶然细节', '噪声|偶然|记忆|记住'), criterion('通过未见数据检查泛化', '泛化|验证|未见|新数据')]),
  task('complexity-delayed-transfer', 'complexity', 'transfer', 'delayed',
    '延时迁移：在只有30份独立问卷的数据中，复制每份问卷50遍是否等于收集1500份独立问卷？为什么二者对泛化的作用可能不同？',
    [criterion('复制不等于新增独立样本', '不等|不能|不是|不同'), criterion('指出独立信息或多样性没有增加', '信息|多样|重复|相同'), criterion('解释对偶然细节或泛化的作用', '偶然|噪声|泛化|代表性')], [], 3),

  task('early_stopping-explain', 'early_stopping', 'explain', 'diagnostic',
    '训练损失一直下降，独立验证损失第8轮最低，此后持续上升。你会保留哪个检查点？请解释选择依据，并说明测试集的角色。',
    [criterion('保留验证最佳的第8轮', '第?8轮|第八轮|验证.{0,8}(最低|最好)'), criterion('用泛化而不是训练损失选轮数', '验证|泛化|过拟合'), criterion('测试集用于独立最终评估', '测试.{0,10}(独立|最终|最后)|独立.{0,8}测试')],
    [mistake('增加训练轮数必然改善泛化', '(继续|增加|加大).{0,8}(轮数|训练).{0,8}(一定|必然|肯定).{0,8}(好|改善|泛化)')]),
  task('early_stopping-transfer', 'early_stopping', 'transfer', 'diagnostic',
    '另一次训练中，第5轮训练/验证损失为0.4/0.5，第15轮为0.2/0.6，第25轮为0.1/0.8。若只能选择现有检查点，你选哪个？训练损失最低为什么不一定是最优选择？',
    [criterion('选择第5轮', '第?5轮|第五轮'), criterion('依据验证损失而非训练最低', '验证|泛化|未见'), criterion('指出后期可能拟合噪声或过拟合', '过拟合|噪声|偶然|训练.{0,8}(不代表|不等于|不一定)')]),
  task('early_stopping-probe', 'early_stopping', 'explain', 'diagnostic',
    '有人说“训练损失还在下降，所以继续训练一定更好”。你如何用验证趋势检查这句话？',
    [criterion('反对训练下降保证泛化改善', '不一定|不能|不代表|不同意|未必'), criterion('考察独立验证变化', '验证|未见|泛化')], [], 1),
  task('early_stopping-post-explain', 'early_stopping', 'explain', 'posttest',
    '神经网络验证损失在第12轮最低，第20轮训练损失更低但验证更差。你会部署哪个检查点？说明为什么，并解释何时使用保留的测试集。',
    [criterion('选择第12轮', '第?12轮|第十二轮'), criterion('以验证表现选择泛化较好的检查点', '验证|泛化'), criterion('最终方案才做独立测试', '独立|最终|最后|不参与')]),
  task('early_stopping-post-transfer', 'early_stopping', 'transfer', 'posttest',
    '小验证集损失偶有一次上升，随后又下降。是否应看到一次上升就立即终止？请提出避免被波动误导的停止方案，且不借助测试集调轮数。',
    [criterion('不因单次波动立即停止', '不一定|不能|不应|波动|噪声'), criterion('耐心等待或平滑趋势并保存验证最佳', '耐心|patience|连续|平滑|多轮|检查点|最佳'), criterion('依据验证而非测试选择', '验证|测试.{0,8}(不|独立)')], [], 3),
  task('early_stopping-delayed-explain', 'early_stopping', 'explain', 'delayed',
    '延时检查：第6轮验证误差最低，而第18轮训练误差最低。请说明早停会保留哪个检查点、它试图控制什么，以及最终测试什么时候进行。',
    [criterion('保留第6轮', '第?6轮|第六轮'), criterion('控制过拟合或改善泛化', '过拟合|泛化|噪声'), criterion('测试不参与检查点选择', '最终|最后|独立|不参与')]),
  task('early_stopping-delayed-transfer', 'early_stopping', 'transfer', 'delayed',
    '延时迁移：序列模型训练误差持续下降，但过去四次验证均比第9轮差。你如何保存与停止训练？若想调整等待轮数，应使用什么数据？',
    [criterion('保留验证最佳的第9轮并考虑停止', '第?9轮|第九轮|最佳|最好'), criterion('关注验证趋势和等待机制', '验证|耐心|patience|连续|等待'), criterion('等待轮数用验证而不是测试调整', '验证.{0,10}(调|选)|测试.{0,8}(不|独立)|不.{0,6}测试')], [], 3),

  task('regularization-explain', 'regularization', 'explain', 'diagnostic',
    '过拟合时为什么可以尝试L2正则化？请解释它限制了什么，以及为什么训练误差可能略升而验证表现反而改善。',
    [criterion('约束参数大小或有效复杂度', '参数|权重|复杂度|惩罚'), criterion('减少对噪声的拟合', '噪声|偶然|过拟合'), criterion('区分训练拟合与验证泛化', '训练.*(验证|泛化)|(验证|泛化).*训练')],
    [mistake('训练误差上升必然泛化更差', '训练误差.{0,6}(升高|上升|变大).{0,6}(一定|必然).{0,8}(更差|变差)')]),
  task('regularization-transfer', 'regularization', 'transfer', 'diagnostic',
    '正则系数从0.01增加到100后，训练与验证都显著变差，并低于已知可靠基线。是否继续增大系数？说明可能原因，以及如何选系数。',
    [criterion('过强正则可能欠拟合', '欠拟合|约束过强|限制过强|正则.{0,5}(过强|太强|过大)'), criterion('不盲目继续增大', '不应|不要|不能|不一定|减小|降低|不继续'), criterion('用验证集选择强度', '验证')],
    [mistake('正则化越强越好', '正则.{0,8}越(强|大)越好|系数越大越好')]),
  task('regularization-probe', 'regularization', 'explain', 'diagnostic',
    '如果把所有权重强制压到接近0，模型是否一定能泛化最好？这时可能损失哪种能力？',
    [criterion('不是越强越好', '不一定|不能|不是|未必'), criterion('过强约束可能欠拟合', '欠拟合|表达|拟合能力|学不到|不足')], [], 1),
  task('regularization-post-explain', 'regularization', 'explain', 'posttest',
    '线性分类器使用适度L2后，训练准确率从99%降至95%，独立验证从78%升至86%。请解释可能机制，以及为什么不能只凭训练准确率拒绝这种设置。',
    [criterion('限制参数或复杂度', '参数|权重|复杂度|惩罚'), criterion('减少噪声拟合或过拟合', '噪声|过拟合|偶然'), criterion('泛化应看独立验证', '验证|泛化|未见')]),
  task('regularization-post-transfer', 'regularization', 'transfer', 'posttest',
    '三个正则系数在验证集上的误差为0.01→0.20、1→0.14、1000→0.35。若其余流程相同，应优先选择哪个？如何解释最强约束反而最差，并安排最终测试？',
    [criterion('选择验证最好的系数1', '系数1|选择1|选1|1的|中间|第二'), criterion('强正则可能欠拟合', '欠拟合|约束过强|过强|太强'), criterion('最终独立测试而非反复调参', '独立|最终|不参与|最后')], [], 3),
  task('regularization-delayed-explain', 'regularization', 'explain', 'delayed',
    '延时检查：正则化为什么可能降低训练拟合却改善未见数据表现？请同时解释它过强时的风险。',
    [criterion('约束参数或复杂度', '参数|权重|复杂|约束|惩罚'), criterion('减少噪声拟合', '噪声|偶然|过拟合'), criterion('过强可能欠拟合', '欠拟合|表达能力不足|限制过强')]),
  task('regularization-delayed-transfer', 'regularization', 'transfer', 'delayed',
    '延时迁移：你给小数据分类器增加很强的权重衰减后，两套数据上的误差都升高，且均劣于合理基线。如何诊断并调整？怎样检验调整有效？',
    [criterion('考虑过强约束导致欠拟合', '欠拟合|过强|太强|过大'), criterion('尝试降低强度而非保证结果', '降低|减小|减弱|较小'), criterion('在验证集比较并保留测试独立', '验证|独立测试')], [], 3),

  task('validation-explain', 'validation', 'explain', 'diagnostic',
    '请说明训练集、验证集、测试集各自的职责。为什么反复查看测试分数选择超参数后，最高测试分数不再是可靠的独立评估？',
    [criterion('训练集拟合模型', '训练.{0,12}(拟合|学习|参数)'), criterion('验证集用于调参和选择', '验证.{0,12}(调|选|比较)'), criterion('测试参与选择会产生偏差', '泄漏|乐观|偏高|不独立|选择偏差|失去独立')],
    [mistake('反复测试调参仍独立', '反复.{0,8}测试.{0,10}(仍然独立|依然独立|不影响独立)')]),
  task('validation-transfer', 'validation', 'transfer', 'diagnostic',
    '同一位患者有多条记录。先在全部记录上拟合标准化参数，再随机分行划分训练/验证/测试，会有哪些泄漏？请提出改法。',
    [criterion('按患者分组避免同一实体跨集合', '患者|分组|同一.{0,5}(人|对象)|实体'), criterion('预处理只在训练集拟合', '训练.{0,12}(拟合|标准化|参数)|拟合.{0,12}训练'), criterion('划分后再拟合并应用到验证测试', '划分后|先划分|只在|仅.{0,5}训练|变换|应用')], [], 3),
  task('validation-probe', 'validation', 'explain', 'diagnostic',
    '如果每次看到测试集表现就修改树深度，为什么最后的测试分数可能过于乐观？应把选择参数的工作放在哪里？',
    [criterion('测试已参与选择而失去独立性', '泄漏|偏高|乐观|不独立|参与.{0,8}(选|调)|过拟合'), criterion('使用验证集选择参数', '验证')], [], 1),
  task('validation-post-explain', 'validation', 'explain', 'posttest',
    '团队用测试集比较30组树深度，再报告最高分。请解释该流程的评估偏差，并重新安排训练、超参数选择和最终测试。',
    [criterion('发现测试参与选择的乐观偏差', '乐观|偏高|泄漏|不独立|选择偏差'), criterion('验证集选超参数', '验证.{0,10}(选|调|比较)|(选|调).{0,10}验证'), criterion('保留未参与选择的独立测试', '独立|未参与|新的测试|保留')]),
  task('validation-post-transfer', 'validation', 'transfer', 'posttest',
    '时间序列系统要预测未来一周。有人随机打乱全部月份划分，并用全时段数据选择特征。如何构建更贴近部署的评估，避免未来信息影响选择？',
    [criterion('按时间划分过去训练未来评估', '时间|过去|未来|顺序'), criterion('特征或预处理仅在训练部分拟合', '训练.{0,12}(特征|拟合|选择|预处理)|只.{0,8}训练'), criterion('用验证选择且测试保持独立', '验证|独立|未参与')], [], 3),
  task('validation-delayed-explain', 'validation', 'explain', 'delayed',
    '延时检查：为什么模型选择需要验证数据，而最终报告还需要未参与模型选择的测试数据？如果已反复用测试调参，应如何处理？',
    [criterion('验证用于模型选择', '验证.{0,12}(选|调)|(选|调).{0,10}验证'), criterion('测试保持独立避免乐观偏差', '独立|偏高|乐观|泄漏'), criterion('旧测试不能继续充当独立最终评估', '新的|重新|另.{0,5}测试|不再|未参与')]),
  task('validation-delayed-transfer', 'validation', 'transfer', 'delayed',
    '延时迁移：商品推荐数据中，同一用户的近重复记录跨训练和测试，文本词表也在全量数据上学习。如何修正划分和预处理，并依据实际部署目标说明理由？',
    [criterion('审查用户或近重复跨集问题', '用户|分组|去重|近重复|实体'), criterion('预处理或词表只在训练部分拟合', '训练.{0,14}(词表|拟合|学习|预处理)|只.{0,8}训练'), criterion('按部署场景保留独立评估', '部署|独立|新用户|时间|未来|泛化')], [], 3)
];

const taskById = id => TASKS.find(item => item.id === id);
function publicTask(item) {
  if (!item) return null;
  const { id, conceptId, kind, phase, prompt, hintLevel, difficulty, form } = item;
  return { id, conceptId, kind, phase, prompt, hintLevel, difficulty, form };
}

function isIndependent(turn) {
  const level = Number(turn.support?.level ?? turn.task?.hintLevel ?? 0);
  return level === 0 && turn.support?.answerSeen !== true;
}
function isFullExplanation(turn) {
  // A short targeted probe cannot substitute for the complete explanation task.
  return turn.task.kind === 'explain' && !turn.task.id.endsWith('-probe') && turn.task.difficulty !== 1;
}

function conceptSummary(session, conceptId) {
  const indexed = (session.turns || []).map((turn, index) => ({ turn, id: turn.id ?? turn.turnId ?? index + 1 }));
  const all = indexed.filter(({ turn }) => turn.task?.conceptId === conceptId);
  const phase = all.at(-1)?.turn.task.phase ?? 'diagnostic';
  const active = all.filter(({ turn }) => turn.task.phase === phase);
  const scored = active.filter(({ turn }) => ['correct', 'partial', 'wrong'].includes(turn.assessment?.correctness));
  const score = scored.length ? Math.round(scored.reduce((sum, { turn }) => sum + ({ correct: 1, partial: .5, wrong: 0 }[turn.assessment.correctness]), 0) / scored.length * 100) : null;
  const latest = predicate => active.filter(({ turn }) => predicate(turn)).at(-1);
  const explain = latest(isFullExplanation);
  const transfer = latest(turn => turn.task.kind === 'transfer');
  const required = [explain, transfer];
  const independentCorrect = item => item && isIndependent(item.turn) && item.turn.assessment?.correctness === 'correct';
  const lastRequiredIndex = required.every(Boolean) ? Math.max(...required.map(item => active.indexOf(item))) : -1;
  const laterContradiction = lastRequiredIndex >= 0 && active.slice(lastRequiredIndex + 1).some(({ turn }) => turn.assessment?.correctness !== 'correct' || (turn.assessment?.misconceptions || []).length);
  const verified = required.every(independentCorrect) && !laterContradiction && required.every(item => !(item.turn.assessment.misconceptions || []).length);
  const hasPositive = scored.some(({ turn }) => ['correct', 'partial'].includes(turn.assessment.correctness));
  const status = verified ? 'verified' : !scored.length ? 'unknown' : hasPositive ? 'developing' : 'needs_work';
  const independentCount = active.filter(({ turn }) => isIndependent(turn) && ['correct', 'partial', 'wrong'].includes(turn.assessment?.correctness)).length;
  // Old phase errors remain in the event log, but are not reported as unresolved in a new phase.
  const relevant = active.filter(({ turn }) => turn.assessment?.correctness !== 'correct');
  const misconceptions = verified ? [] : [...new Set(relevant.flatMap(({ turn }) => turn.assessment?.misconceptions || []))];
  const phaseLabel = { diagnostic: '初始诊断', posttest: '即时复测', delayed: '延时检查' }[phase] || phase;
  let reliability;
  if (!active.length) reliability = '尚无证据';
  else if (!scored.length) reliability = `${phaseLabel}证据不足，允许弃判`;
  else if (verified) reliability = `${phaseLabel}的完整解释与迁移均独立通过；不是稳定掌握概率`;
  else if (required.some(item => item && !isIndependent(item.turn))) reliability = `${phaseLabel}存在受助或已见答案的表现，需撤架后用新题复核`;
  else reliability = `${phaseLabel}尚缺完整独立解释、迁移或一致证据`;
  return { conceptId, status, score, evidenceCount: all.length, independentCount, reliability, misconceptions,
    evidenceIds: all.map(item => item.id), phase };
}

function eligibleDiagnostic(session) {
  if (session.phase && session.phase !== 'diagnostic') return [];
  const turns = (session.turns || []).filter(turn => turn.task?.phase === 'diagnostic');
  if (turns.length >= 10) return [];
  const done = new Set(turns.map(turn => turn.task.id));
  // Always obtain one independent opportunity for every capability before specializing.
  const first = CONCEPTS.map(concept => taskById(`${concept.id}-explain`)).find(item => !done.has(item.id));
  if (first) return [first];
  if (session.strategy === 'fixed') {
    const next = CONCEPTS.map(concept => taskById(`${concept.id}-transfer`)).find(item => !done.has(item.id));
    return next ? [next] : [];
  }
  return TASKS.filter(item => {
    if (item.phase !== 'diagnostic' || done.has(item.id)) return false;
    if (!item.id.endsWith('-probe')) return true;
    return turns.some(turn => turn.task.conceptId === item.conceptId &&
      (turn.assessment?.correctness !== 'correct' || (turn.assessment?.misconceptions || []).length));
  });
}

function nextDiagnostic(session, lastTask, assessment) {
  const candidates = eligibleDiagnostic(session);
  if (candidates.length <= 1) return candidates[0] || null;
  if (lastTask && assessment && (assessment.correctness !== 'correct' || (assessment.misconceptions || []).length)) {
    const followup = candidates.find(item => item.id === `${lastTask.conceptId}-probe`);
    if (followup) return followup;
  }
  const priority = item => {
    const turns = (session.turns || []).filter(turn => turn.task.conceptId === item.conceptId && turn.task.phase === 'diagnostic');
    const last = turns.at(-1)?.assessment;
    const needsClarification = !last || last.correctness === 'insufficient';
    const error = last?.correctness === 'wrong' || (last?.misconceptions || []).length;
    const partial = last?.correctness === 'partial';
    const probe = item.id.endsWith('-probe');
    return probe ? (error ? 5 : needsClarification ? 4 : partial ? 3 : 0) : (turns.some(turn => turn.task.kind === 'transfer') ? 0 : 2);
  };
  return candidates.slice().sort((left, right) => priority(right) - priority(left))[0] || null;
}

function offlineAssess(item, answer) {
  const original = String(answer ?? '');
  const text = original.replace(/\s+/g, '');
  const hits = item.criteria.filter(rule => new RegExp(rule.pattern, 'i').test(text));
  const misconceptions = item.misconceptions.filter(rule => new RegExp(rule.pattern, 'i').test(text)).map(rule => rule.label);
  const uncertain = /^(我)?(不知道|不清楚|不懂|不会|随便)([。.!！?？]|$)|不知道(怎么|如何)|不会(做|解|回答)/.test(text);
  const correctness = uncertain || text.length < 8 ? 'insufficient' : misconceptions.length ? 'wrong' : hits.length === item.criteria.length ? 'correct' : hits.length ? 'partial' : 'insufficient';
  return { correctness, evidenceQuotes: correctness === 'insufficient' ? [] : [original.slice(0, 240)],
    demonstrated: hits.map(rule => rule.label), missing: item.criteria.filter(rule => !hits.includes(rule)).map(rule => rule.label),
    misconceptions, rationale: '离线关键词规则演示：不理解语义，可能误判否定、反讽和关键词复述；结果需人工复核，不能作为真实掌握标签。',
    provider: 'offline-rules', model: null, promptVersion: VERSION };
}

const LESSONS = {
  gap: {
    sections: [['先比较拟合与泛化', '训练指标衡量已见样本的拟合；独立、适当划分的验证数据提供未见表现的证据。明显差距提示过拟合，但还要排查划分、分布变化、泄漏与指标选择。'],
      ['差距小也要看基准', '训练和验证都低于可靠基准，可能是欠拟合，也可能与数据或流程有关。没有任务难度、类别分布和可达性能信息时，不能仅凭60%断言欠拟合。']],
    example: '在同分布、无泄漏且可靠基线可达90%的任务上，训练/验证98%/70%提示泛化差距；60%/59%提示整体拟合不足。两种诊断都需要检查数据与流程。'
  },
  complexity: {
    sections: [['把原因连起来', '表达能力强的模型在有限样本上，既能学习规律，也能拟合噪声和偶然细节。后者不稳定，所以低训练误差不保证低泛化误差。'],
      ['增加有效信息', '有代表性的独立新数据提供更多信息；复制旧样本没有增加独立信息。增加数据、控制复杂度的效果仍需验证，不能保证任何一种调整一定成功。']],
    example: '深树可能用少量样本独有的噪声特征分支。重复这些样本会重复噪声；新增覆盖更多情况的独立样本更可能帮助区分稳定规律与偶然细节。'
  },
  early_stopping: {
    sections: [['保存验证表现最佳的检查点', '持续降低训练误差可能开始拟合噪声。用验证集观察趋势、选择检查点，而不是直接选择训练误差最低的一轮。'],
      ['允许波动，保持测试独立', '单次验证波动不必立刻触发停止，可预设耐心轮数并保存最佳检查点。停止参数用验证数据选择，测试数据保留给最终独立评估。']],
    example: '另一个实验中验证误差第4轮最低，第11轮训练误差最低：候选检查点优先依据第4轮验证表现，必要时按预定耐心规则等待，不用测试结果反复挑轮数。'
  },
  regularization: {
    sections: [['限制拟合偶然细节的自由度', 'L2通过惩罚较大的权重，限制模型有效复杂度。适度约束可能让训练误差变大，却减少对噪声的依赖，进而改善独立验证表现。'],
      ['约束需要平衡', '正则化不是越强越好。过强时模型表达受到过多限制，可能欠拟合。用验证集比较多个强度，不能把训练分数降低等同于泛化变差，也不能保证增加正则一定有效。']],
    example: '在另一组实验中，中等强度的权重约束验证最好，极强约束把权重压得接近0而两边都差。应检查是否欠拟合，再用验证集比较更合理的范围。'
  },
  validation: {
    sections: [['分清拟合、选择和评估', '训练集拟合模型参数以及标准化、词表等预处理。验证集选择超参数与训练检查点。未参与这些选择的测试集用于最终评估；反复测试调参会产生选择偏差。'],
      ['按部署情境划分', '先确定部署要预测新对象还是未来时间，再分组或按时间划分。预处理只在训练部分拟合，再应用到验证和测试；避免近重复记录、同一实体或未来信息泄漏。']],
    example: '预测新学校学生成绩时，应检查同一学校或学生的相关记录是否跨集。先按部署对象划分，再在训练数据拟合预处理；验证选择方案，独立测试评价最终方案。'
  }
};

const MISCONCEPTION_FEEDBACK = [
  { pattern: /训练.{0,12}(高分|99|高).*过拟合|仅凭训练/, text: '高训练分数只描述对已见样本的拟合，不能单独证明过拟合。补充独立、同分布验证表现并比较差距，再检查数据与指标条件。' },
  { pattern: /60%|仅凭准确率|差距小|分数接近/, text: '小差距不等于任务完成得好，某个绝对准确率也没有固定含义。先比较类别基准、可靠模型和任务难度，再考虑是否存在整体拟合不足。' },
  { pattern: /复制|重复.*样本|独立新样本/, text: '重复记录不增加独立信息，它可能改变优化权重，却不能代替覆盖新情况的独立样本。检查新增数据的代表性，并在独立验证数据上比较效果。' },
  { pattern: /随机标签|可靠规律|记忆.*泛化/, text: '高容量模型能记忆随机标签，这说明拟合能力强，不代表识别了可迁移规律。可靠学习还需要在未参与拟合的新数据上验证。' },
  { pattern: /训练轮数|训练误差最低|继续训练|训练损失最低/, text: '训练误差下降并不保证泛化改善。保存验证表现最佳的检查点，按预先设定的耐心机制检查趋势；选择训练轮数不能依赖测试分数。' },
  { pattern: /越强越好|越大越好|正则.{0,8}(过强|太强|过大)/, text: '约束太强会让模型连稳定规律也难以表达，造成欠拟合。正则强度需要验证比较，可尝试减弱约束，不能把增大系数当成单向改善。' },
  { pattern: /训练误差.*(上升|升高|变大)|训练.*泛化更差/, text: '正则可能牺牲部分训练拟合，换来更少的噪声记忆。应同时比较训练和独立验证表现；仅见训练误差上升不足以判断模型变差。' },
  { pattern: /测试.*(调参|选择|独立)|反复.*测试|测试泄漏/, text: '测试结果一旦影响方案选择，就成为选择过程的一部分。后续选择应使用验证数据，最终评估需要未参与任何选择的独立数据，不能继续声称旧测试独立。' },
  { pattern: /全量|全部数据|预处理|标准化|词表/, text: '标准化、词表和特征筛选也会学习数据特征。先划分数据，仅在训练部分拟合，再把同一变换应用于验证和测试，避免未见数据信息提前影响模型。' },
  { pattern: /近重复|同一对象|患者|跨集合|跨集|未来/, text: '划分单位要与部署目标一致。预测新对象时审查同一实体跨集，预测未来时按时间组织评估；去除不符合部署场景的近重复与未来信息。' }
];

function createLesson(session, conceptId) {
  const concept = CONCEPTS.find(item => item.id === conceptId);
  if (!concept) throw new Error('未知知识点');
  const content = LESSONS[conceptId];
  const misconceptions = conceptSummary(session, conceptId).misconceptions;
  const sections = content.sections.map(([heading, text]) => [heading, text]);
  const corrections = [...new Set(misconceptions.flatMap(label => MISCONCEPTION_FEEDBACK.filter(item => item.pattern.test(label)).map(item => item.text)))];
  for (const [index, correction] of corrections.entries()) sections.unshift([`修正依据${index + 1}`, correction]);
  if (misconceptions.length) sections.unshift(['先处理这次暴露的误解', `你的回答中记录了：${misconceptions.join('；')}。请对照下面的机制与边界，解释原判断需要怎样修正。记录只表示当前证据，允许在后续回答中修正。`]);
  return { conceptId, title: `${concept.label}：针对性微课`, objective: concept.objective, sections,
    example: content.example, misconceptions, source: `curated:${VERSION}` };
}

const HINTS = {
  gap: ['分别看模型对已见样本和未见样本的表现，不只看一个分数。', '写出两个表现的差距，再问这个任务的合理基准是什么。', '另一个任务中，训练与验证分数相近只说明差距小；若多数类基准更高，还不能说模型有效。请把这种比较方法用在当前题。'],
  complexity: ['想一想：模型学到的是稳定规律，还是只在这批数据出现的细节？', '分别列出模型能表达的复杂程度、独立样本量，以及新数据是否包含相同噪声。', '例如记住某张练习卡片的污点不会帮助识别新卡片；重复复印同一张卡片也没增加新内容。请类比当前数据情境。'],
  early_stopping: ['选择模型的目标是在未见数据上表现好，先找对应的观测信号。', '把检查点按验证表现排序，区分训练继续变好与泛化是否改善。', '例如练习越熟不保证新题越好，可定期用未参与练习的检查材料观察趋势；最后再用保留材料检验。请映射到当前训练过程。'],
  regularization: ['考虑限制模型自由度可能带来的好处与代价。', '分别讨论约束太弱、适中和太强，注意训练拟合与泛化可能朝不同方向变化。', '例如曲线平滑程度过弱会追随测量抖动，过强又可能抹掉真实变化。请说明类似权衡如何由未见数据检验。'],
  validation: ['区分“用来学参数”“用来挑方案”和“最终检验”的数据。', '追踪哪些信息影响了模型、预处理和参数选择，再检查最终评估是否独立。', '例如练习卷用来练习、模拟卷用来调整方法，反复依据期末试卷改方法会失去独立检验。请检查当前流程有没有相似问题。']
};

function selectHint(item, level) {
  if (!item || item.phase !== 'diagnostic') return null;
  if (!Number.isInteger(level) || level < 1 || level > 3) throw new Error('提示等级必须为1、2或3');
  const hints = HINTS[item.conceptId];
  if (!hints) throw new Error('未知知识点');
  return { level, text: hints[level - 1], answerSeen: false };
}

module.exports = { VERSION, CONCEPTS, TASKS, taskById, publicTask, offlineAssess, conceptSummary,
  eligibleDiagnostic, nextDiagnostic, createLesson, selectHint };
