# 参考实现、来源与证据边界

核查日期：2026-10-20。本项目的目标是把师生自然语言交互变成可追溯的理解证据，并检验教学后能否独立完成新任务。参考项目用于决定工具、上下文、运行状态和评测边界；其功能介绍不构成本项目已经实现或验证的证据。

本轮按机制重新设计实现，没有复制下列第三方实现代码。GitHub 分支会变化，固定提交链接用于复核已阅读材料。OpenMAIC 的本地材料为目录快照，因此单独标注版本与提交来源的不确定性。

## 来源登记

| 参考 | 已核查版本 | 协议与使用边界 | 官方入口 |
| --- | --- | --- | --- |
| OpenMAIC | 本地 `OpenMAIC-main/package.json` 标示 `1.2.0-rc.1`；目录自身没有 `.git`，无法据此确定官方提交 | 根 `LICENSE` 为 MIT，Copyright 2026 THU-MAIC。复制其代码时应保留许可及版权；本轮仅借鉴机制 | [THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) |
| Learn Claude Code | `ce8f9f186058939da54c9d6fead78dfb5d0fd6c3`，本地提交日期 2026-09-28 | MIT，Copyright 2024 shareAI Lab；这是教学实现，不能直接当作生产安全保证 | [固定提交](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3) · [LICENSE](https://github.com/shareAI-lab/learn-claude-code/blob/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/LICENSE) |
| Claude Code 官方公开仓库 | `dd6bee38458cc3e6dc5f2b16eca1f0f364619ad8`，本地提交日期 2026-10-17 | 根 `LICENSE.md` 写明 Anthropic 保留所有权利、适用 Commercial Terms；不能按 MIT 项目复制 | [固定提交](https://github.com/anthropics/claude-code/tree/dd6bee38458cc3e6dc5f2b16eca1f0f364619ad8) · [LICENSE.md](https://github.com/anthropics/claude-code/blob/dd6bee38458cc3e6dc5f2b16eca1f0f364619ad8/LICENSE.md) |

本地 OpenMAIC 目录的上级目录另有 Git 仓库。在该目录直接执行 `git rev-parse HEAD` 会读到上级仓库的提交，而非 OpenMAIC 版本，因此没有将这个提交作为来源。下面 OpenMAIC 链接指向官方 `main`，用来定位文件，不保证与本地快照逐字相同。

## Learn Claude Code：可组合的执行机制

本地教程现行主线为根目录 `s01`–`s17`；`docs/`、`agents/` 保留的是旧 12 课轨道，两者编号不能混用。[版本说明](https://github.com/shareAI-lab/learn-claude-code/blob/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/README.md#version-status)

| 已阅读位置 | 机制与对教育场景的启发 | 落地约束 |
| --- | --- | --- |
| [s01 agent loop](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s01_agent_loop)、[s02 tools](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s02_tool_use) | 模型请求工具、宿主执行、结果返回同一循环；工具由描述、参数契约和处理器注册 | 教育工具应表达“读取评分标准、提取证据、选择任务”等有限能力；每个结果应可校验、可记录 |
| [s03 permissions](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s03_permission)、[s04 hooks](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s04_hooks) | 在执行边界统一处理权限和审计，减少每个业务函数自行实现规则 | 角色权限由服务端注册表确定；学生回答中的“忽略规则”不能扩大工具权限；拒绝和失败也应记录 |
| [s06 subagents](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s06_subagent) | 子任务使用独立消息历史，返回有限结论 | 评估者只收到任务、回答、帮助条件和必要上下文；教学者不应通过共享长上下文提前泄露独立复核答案。消息隔离不等于进程或文件系统隔离 |
| [s07 skills](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s07_skill_loading) | 先提供技能名称和描述，按需读取完整材料 | 按知识点加载评分标准和误解库；学生内容和导入资料作为待分析数据，不作为宿主指令 |
| [s08 context](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s08_context_compact)、[s09 memory](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s09_memory) | 大输出先落盘和缩短，旧历史再摘要；长期记忆有索引、选择与按需读取 | 保留原始对话作为审计依据；运行摘要可以缩短，标签和原话证据不能被摘要覆盖。不要把任意截断称为无损压缩 |
| [s10 tasks](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s10_task_system)、[s11 background](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s11_background_tasks) | 任务有稳定 ID、依赖和持久状态；慢任务先返回任务 ID，完成事件稍后送达 | 一次评估要能区分进行中、完成、失败和中断；重试不能重复提交学生回答。前台已返回不等于后台任务已完成 |
| [s13 teams](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s13_agent_teams) | 独立角色、类型化消息、原子领取任务、收件箱与空闲状态 | 小 Demo 可先采用顺序的评估者、策略选择者和教学者；三个角色名称本身不能证明存在三个自治 Agent，也不需要照搬团队和 worktree 机制 |
| [s14 MCP](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s14_mcp_plugin) | 动态发现工具并放入统一工具池 | 该课 `docs`/`deploy` 是进程内模拟，没有实现真实 MCP transport；本项目的内部工具注册表也不能直接标为 MCP 集成 |
| [s15 integrated harness](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s15_integrated_harness) | 上下文、工具、钩子、权限、任务和通知围绕一个循环组合 | 应检查同一组约束是否覆盖所有角色，尤其子任务不能绕过超时、预算和审计 |
| [s16 workflow runtime](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s16_workflow_runtime) | 已知流程由宿主执行；结构化结果验证、运行快照和 journal 支持恢复，语义稳定的键避免重复执行 | 诊断→教学→复核是可控流程；模型在有限动作中判断。恢复应复用已提交结果，不能按并发完成顺序作为缓存键 |
| [s17 goal loop](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/s17_goal_loop) | 主执行者提出结束，独立检查者检查完成条件；未完成、错误和超限分开处理 | 学生对话需要硬性轮数及调用预算，结束条件需要证据。LLM 自我认可不是独立学习效果证明，不能用自动继续强迫学生无限作答 |

教程的 Shell 权限示例、同进程子任务和文件持久化是教学机制，不能直接当作多用户身份隔离、沙箱或数据库事务。尤其子任务“fresh messages”只表示上下文分离。

## OpenMAIC：教学闭环与服务端运行保障

OpenMAIC 的范围包括课程生成、课堂呈现、多角色交流及媒体能力。本项目重点复用它对学习证据与运行边界的设计思路，暂不照搬其整套产品技术栈。

| 本地已核查文件 | 发现与本项目的应用 |
| --- | --- |
| [ZPD skill](https://github.com/THU-MAIC/OpenMAIC/blob/main/skills/agent-runtime/zone-of-proximal-development/SKILL.md)、[exercise lesson](https://github.com/THU-MAIC/OpenMAIC/blob/main/skills/agent-runtime/zone-of-proximal-development/references/exercise-lesson.md) | 区分独立诊断、定向帮助、受助练习、新任务撤架复核。指向关键步骤的追问本身属于支持；复述原题或看过答案后的正确不能直接算作独立证据 |
| [proficiency.ts](https://github.com/THU-MAIC/OpenMAIC/blob/main/packages/@openmaic/generation/src/pbl/operations/kernel/proficiency.ts) | 模型把观察分类，能力数值由纯代码更新；采用 EWMA、信号权重、最少信号数量、阈值滞回和冷却减少等级震荡。它已经包含动态能力估计，不能说 MAIC 只有内容生成 |
| [build-agent.ts](https://github.com/THU-MAIC/OpenMAIC/blob/main/lib/agent/runtime/build-agent.ts)、[allowlist.ts](https://github.com/THU-MAIC/OpenMAIC/blob/main/lib/agent/runtime/allowlist.ts) | 所审快照的这一条 agent runtime 使用 `@earendil-works/pi-agent-core`，由请求侧提供工具和名称白名单；整个项目还有 LangGraph 路径，不能概括成全部由一个框架实现 |
| [tool-timeout.ts](https://github.com/THU-MAIC/OpenMAIC/blob/main/lib/agent/runtime/tool-timeout.ts) | 每次工具调用有 deadline 和派生 AbortSignal；外层取消或超时都能结束等待，迟到的进度应丢弃。只有 `Promise.race` 不能保证下游停止写入 |
| [mutation-fence.ts](https://github.com/THU-MAIC/OpenMAIC/blob/main/lib/server/agent-runtime/mutation-fence.ts) | 取消信号传到持久化边界，写前/写后检查运行是否有效，避免超时后的旧任务提交结果 |
| [tool-call-integrity.ts](https://github.com/THU-MAIC/OpenMAIC/blob/main/lib/server/agent-runtime/tool-call-integrity.ts) | 工具调用必须有对应结果；中断后的模型视图可以补中断收据、重排相关结果，同时保留原始审计记录 |
| [runner.ts](https://github.com/THU-MAIC/OpenMAIC/blob/main/lib/server/agent-runtime/runner.ts)、[config.ts](https://github.com/THU-MAIC/OpenMAIC/blob/main/lib/server/agent-runtime/config.ts) | 服务端维护租约、心跳、attempt 和恢复；快照默认并发为 2、最多连续无人干预尝试为 5。单机 Demo 应明确自己的并发范围，不把内存锁描述为分布式租约 |
| [quota.ts](https://github.com/THU-MAIC/OpenMAIC/blob/main/lib/agent/runtime/quota.ts)、[build-agent.ts](https://github.com/THU-MAIC/OpenMAIC/blob/main/lib/agent/runtime/build-agent.ts) | `QuotaSource` 标为 v0 stub，默认源返回 `Number.MAX_SAFE_INTEGER`；已读代码不能证明其接通了真实信用额度或 token 配额。本项目需要自己实现调用次数和时间上限 |

OpenMAIC 的能力分数、默认阈值和信号权重是其工程设计，不能直接移植为本项目已经标定的掌握概率。需要用本项目教师标注和独立测试数据验证。当前快照的原生上下文压缩还受配置开关控制，不能把可选压缩称为所有会话默认行为。

## Claude Code：公开扩展契约的借鉴范围

本次阅读了官方仓库的 README、`plugins/README.md`、插件 agent 定义与校验流程、`CLAUDE.md` 中的工作流约束，以及 `mods/types/claude-code.d.ts` 的公开 hook 类型。该类型文件标注由 Claude Code `2.1.277` 生成，且为可能变更的 early-access 插件接口；这不是对整套 CLI 安装版本的核验。

- [公开插件说明](https://github.com/anthropics/claude-code/blob/dd6bee38458cc3e6dc5f2b16eca1f0f364619ad8/plugins/README.md)：公开 agent、commands、skills、hooks 等扩展形式。
- [插件 agent 校验](https://github.com/anthropics/claude-code/blob/dd6bee38458cc3e6dc5f2b16eca1f0f364619ad8/plugins/plugin-dev/agents/plugin-validator.md)：说明角色清单、工具能力、元数据和校验边界可以显式定义。
- [公开 hook 类型](https://github.com/anthropics/claude-code/blob/dd6bee38458cc3e6dc5f2b16eca1f0f364619ad8/mods/types/claude-code.d.ts)：用于理解生命周期事件与插件宿主的契约。
- [仓库级工作流约束](https://github.com/anthropics/claude-code/blob/dd6bee38458cc3e6dc5f2b16eca1f0f364619ad8/CLAUDE.md)：说明能力范围与验证要求应由宿主规定；这里的 GitHub workflow 限制属于 Claude Code 仓库自身，不能当作本项目运行要求。

已阅读的公开内容不足以核实完整产品内部的模型循环、私有提示词、压缩实现或训练方式。本项目不能声称“移植 Claude Code 核心源码”或“复刻其内部多 Agent 机制”。本轮借鉴的是公开可见的接口思想；没有引入 Claude Code 商业二进制、SDK 依赖或受其协议约束的源码。

## 本项目的验收边界

设计是否落地应检查实际源文件、接口和自动测试，不以参考项目拥有该能力为证明。以下是审查本轮实现的检查项：

1. 工具注册具有角色允许列表和输入输出验证，学生输入不能修改注册表；拒绝、失败和超时有对应事件。
2. 一次运行有稳定 ID、阶段状态、调用预算、时间上限与版本；耗尽预算不能记录为评估成功。
3. 同一作答重试不会追加两个成功结果；失败和中断保留原因，恢复不会重放已经提交的写操作。
4. 原始学生对话与人工标签不被上下文摘要覆盖；运行摘要、任务结果和证据有来源引用。
5. 帮助等级和是否独立由实际呈现条件决定；同一道受助题不能在下一轮被伪装成未见过的新题。
6. 真实模型、离线规则和模拟测试明确区分；离线工具调度不宣称是模型自主工具调用。

本轮不将下列事项当作已经完成的成果：训练专用权重、真实学生学习成效、标定后的掌握概率、跨进程任务租约、生产多用户身份认证、任意外部 MCP 连接、自治 Agent 团队、课程视频生成。若后续加入这些能力，应补充相应源文件、测试与实验记录。
