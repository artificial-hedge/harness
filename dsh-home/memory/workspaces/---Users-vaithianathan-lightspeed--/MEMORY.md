## 仓库与安全
- `context.md`记录仓库地图。
- 覆盖架构、安全、验证、限制。
- 交易默认纸面运行。
- 所有实盘门禁保持关闭。
- SOTA不得自动晋级实盘。
- Lunar契约缺失时保持关闭。
- 不伪造缺失的verifier。
- 研究结果不等于交易保证。

## 依赖与验证
- `service/requirements.txt`声明加密依赖。
- 新增`cryptography`与`eth-hash`。
- 本地CI通过578项测试。
- 另有1项跳过。
- QStack覆盖率84.50%。
- Ruff仅剩无关测试导入错误。
- 已移除未声明Alpaca依赖。
- urllib3固定2.7.0。
- websockets固定15.0.1。
- `pip check`通过。
- 点数汇率为1点兑1000美元。
- 交易告警仍误用0.01。
- 汇率问题已记录，暂不修改。

## SOTA证据
- `research/sota_charter_v1.json`已冻结。
- `research/sota_preregistration_v1.json`已冻结。
- SOTA协议按序验证证据。
- 协议永久拒绝实盘资格。
- 初始状态均为未达标。
- 通过17项聚焦测试。
- mypy、Ruff、格式检查通过。
- 尚缺点时数据证据。
- 尚缺权威执行校准。
- 尚缺竞争复现证据。
- 尚缺封存优势证据。
- 尚缺独立复现证据。
- 尚缺forward-paper证据。

## Nautica研究
- Ledger采用增量指纹索引。
- JSONL支持增量尾扫。
- 扫描受现有锁保护。
- `records()`仍为O(n)。
- `summary()`仍为O(n)。
- 流式批次避免O(n²)。
- PBO采样有界且确定。
- 样本包含端点路径。
- 样本上限为`pbo_max_configs`。
- 选中候选会重算完整路径。
- 报告保留路径元数据。
- v2测试记录100个候选。
- v2报告保留10行。
- 重放未追加新记录。
- promotion与实盘仍未达标。

## 认证安全
- 前端令牌仅存内存。
- 统一使用`AuthTokenContext`。
- 已删除`claw_token`本地存储。
- WebSocket改用Bearer子协议。
- 查询字符串令牌一律拒绝。
- 缺失及格式错误均拒绝。
- `/api/claw/agents/me`不回传令牌。
- `AgentInfo`不含令牌字段。
- Sidebar不展示或复制令牌。
- 登录注册签发逻辑未变。
- 已覆盖令牌轮换回归。
- 旧令牌立即失效。
- 新令牌可正常认证。
- 恢复挑战仅可使用一次。
- 过期与撤销测试仍保留。

## Stockbook纸面运行
- `python -m nautica`提供CLI别名。
- `shadow`模式不提交订单。
- `run --shadow`同样不提交。
- Shadow记录使用规范JSONL。
- 记录不含墙钟时间。
- 仅记录可成交订单。
- Shadow不消耗真实轮换锁。
- 买入额度使用已结算资金。
- 防止未结算资金买入。
- 保持GFV安全。

## 回测与复现
- PNG比较25个Nautica家族。
- 另含16身份盘中竞赛。
- 文件为`paper_runs/recent_strategy_backtest_20260913/`。
- 两项运行均为纸面研究。
- Nautica promotion为否。
- 盘中开发结论为FAIL。
- Yahoo日线属于代理数据。
- 缺少一分钟数据的策略弃用。
- 日线与盘中不得混排。
- `--no-write`仍会写配置。
- `--no-write`仍会写Ledger。
- 重跑须使用临时副本。
- PNG是证据产物，不是运行器。
- 底层竞赛命令支持复现。
- PNG重建仍缺比较脚本。
- 推荐使用模块命令重跑。
- 包装脚本可能缺少模块路径。
- 必要时设置`PYTHONPATH=.`。

## Harness压缩修复
- 修复文件为`/Users/vaithianathan/.dsh/profiles/web/compat/dsh-multivers.mjs`。
- Multivers已适配DSH流式契约。
- 修复`not async iterable`错误。
- 压缩请求关闭reasoning。
- 压缩请求省略工具schema。
- 确保生成检查点摘要。
- 端口3080进程需重启一次。

## 2026-09-14
The Lightspeed objective remains economically unproven at $100 live: the exact-$100 report shows a required 200% monthly return, while the shipped momentum book's historical eval mean is 3.99%/month and holdout mean is 1.11%/month, with 41–47% drawdowns and negative lower-tail months. The repository now has an exact-input artifact at docs/profit_target_200_at_100.json. Live execution remains fail-closed: LIGHTSPEED_LIVE, STOCKBOOK_LIVE, and LIGHTSPEED_ARM were not set; live Alpaca hosts are rejected; paper defaults report paper_sim, allow_live_trading=false, submits_orders=false. Full local CI passed 142 checks and focused safety regressions passed 39 tests. Next step is capital-building/paper-forward evidence, not live arming or strategy overfitting.

## 2026-09-14
- 以 100 美元实现每月 200 美元收益需要约 200% 月回报，现有研究证据不支持该目标，Lightspeed 仍应保持故障关闭并优先积累资本与验证证据。

## 2026-09-14

## 2026-09-14 — $100 operational verification
The exact-$100 paper plumbing is operational for both `nautica-momentum-v1` and `tqqq-long-full-v1`: offline JSON plans produced fractional cash-only orders with `fillable_ok=true` and live disabled. This is an execution-plumbing result, not profitability evidence.

The reproducible commands and explicit caveat are now documented in `docs/PROFIT_TARGET_200.md`. Capital/profit-report regression tests passed 38/38; the financial objective remains unproven because it requires 200% monthly return from $100.

## 2026-09-14

## 2026-09-14 — Full paper-only CI gate
The complete local CI-equivalent gate passed all 142 checks with `JOBS=4`, including qstack coverage, research and service module suites, Nautica, intraday, fund, leadquant, research health, paper-only defaults, Ruff, mypy, compileall, and whitespace. `scripts/verify_capital_plan.sh` also passed. This verifies repository integrity and safety plumbing; it does not establish the requested 200% monthly live return.

## 2026-09-14

## 2026-09-14 — Forward evidence remains empty
A fresh credential-free paper-only evidence snapshot for `nautica-momentum-v1` reported zero sessions, zero armed-paper cycles, no quote-referenced fills, and `ready for independent research review: no`; structural safety checks passed. The intraday seal remains at zero of 252 required observations and refuses scoring before 2027-09-15. `docs/PROFIT_TARGET_200.md` now states this explicitly.

## 2026-09-14
Nautica safety hardening: `lightspeed_nautica/cli.py` now refuses `status`, `plan`, `preflight`, and `evidence` when `LIGHTSPEED_LIVE=1`, before constructing `AlpacaClient`; an unarmed live `run` is likewise rejected before broker access. Regression coverage is in `tests_nautica/test_deploy_host.py`, and `docs/nauticaeng.md` documents paper/local-only read-only routes. This prevents stray live flags from causing even account-inspection HTTP requests. Live order routing remains disabled and unapproved.

## 2026-09-14
Verification update: exact $100 offline plans remain `fillable_ok: true` for Nautica and TQQQ; this proves fractional-order sizing only, not profitability. Capital/profit-report tests passed 38 checks. A fresh full 142-check gate was launched after the live-preflight hardening; the first foreground attempt exceeded the 120-second tool cap, so completion must be collected from the background job before reporting a final gate result.

## 2026-09-14
Post-hardening gate result: `scripts/run_local_ci.sh` completed successfully with 142 checks across 4 cores, including `tests_nautica/test_deploy_host.py`, research/service/intraday/fund suites, paper-only defaults, Ruff, research health, whitespace, compileall, and mypy. This establishes repository integrity, not trading profitability or promotion eligibility.

## 2026-09-14
- 在缺乏充分前向盈利证据和明确实盘配置授权前，项目继续保持纸面交易、失败关闭的实盘安全门禁，不得宣称可稳定实现$200/月收益。

## 2026-09-14
Round 10 evidence: `python -m lightspeed evidence --offline --json` wrote a Nautica snapshot with 0 marks, 0 armed-paper cycles, and review readiness false. `scripts/run_forward_paper.py --dry-run` evaluated 33 cached assets over 1,528 dates and showed a historical $100→$102.88 path, but `research_promotion` failed, so the risk gate remained closed. The ignored `forward_paper/live/journal.jsonl` contains historical records labeled `armed-live` and `operator_live_fills`; treat them as unverified account artifacts, not proof of current live performance.

## 2026-09-14
The 2026-09-14 agent-science review assembled primary evidence for Lightspeed: ReAct/Toolformer/ToT/Reflexion/Self-Consistency/Self-Refine; debate, AutoGen, HuggingGPT, MetaGPT, MoA, MemGPT; AgentBench, GAIA, WebArena, SWE-bench, τ-bench, InjecAgent, AgentDojo, MT-Bench; and FinQA, FinanceBench, PIXIU, FinMem. Evidence is mostly static or sandboxed tasks, not live finance. Finance controls should require claim-level citations/evidence, deterministic calculations, independent model/source diversity, pre-registered holdouts, pass^k/repeated-run reliability, bounded tool execution, prompt-injection isolation, and human approval; direct evidence for collusion/reward hacking/infinite loops and 2025–26 finance-agent benchmarks remains a gap.

## 2026-09-14
Repository-fit conclusion for an LLM-native hedge-fund infrastructure product: reuse Comet causal simulation/provenance, research-lab statistical validation, QStack causal/competitive protocols, LeadQuant typed policy/risk/sizing/paper execution, and lightspeed_desk's read/propose/paper-only tool constitution. Build the missing institutional layer: point-in-time market/microstructure data, organization→fund→portfolio→account tenancy, durable double-entry/reconciliation ledger, approval-scoped operations, distributed coordination/HA, metrics/traces/alerts, and tamper-evident audit. Do not let an LLM submit/cancel/flatten/arm/promote/mutate/lower evidence gates; do not infer alpha or production readiness from historical backtests or proxy fills. Standalone review canvas: /Users/vaithianathan/.cursor/projects/lightspeed/canvases/llm-hedge-fund-repository-fit.canvas.tsx.

## 2026-09-14
A source-backed infrastructure architecture artifact was created at /Users/vaithianathan/.cursor/projects/---Users-vaithianathan-lightspeed--/canvases/agent-infrastructure-reference-architecture.canvas.tsx. The architecture treats agents as untrusted, budgeted workloads and centralizes policy, routing, identity, provenance, evaluation, and fail-closed budget enforcement. Numeric capacity and cost sizing remain deferred because they require a declared model, hardware, and workload envelope.

## 2026-09-14
The LLM infrastructure pivot now has two durable artifacts: `docs/LLM_HEDGE_FUND_INFRASTRUCTURE_PIVOT.md` and `docs/LLM_HEDGE_FUND_INFRA_SOURCES.md`. The evidence register distinguishes directly read sources, metadata-only pointers, blocked regulatory/academic sources, repository facts, and inference. A standalone decision canvas is at `/Users/vaithianathan/.cursor/projects/lightspeed/canvases/lightspeed-pivot-decision.canvas.tsx`. Strategy remains infrastructure-first, paper-only, and explicitly does not establish trading alpha or authorize live execution.

## 2026-09-16
- Dipcatcher 的敏感 API 必须实施认证与授权，不能仅依赖网络暴露控制。
- MLflow 服务必须私有绑定或置于认证访问之后，默认不得公开暴露。
- 调用方提供的配置、文件路径和资源路径必须限制在 allowlist 工作区内，以防止任意文件访问。
- 同步任务和高资源操作必须限制输入规模、执行时长与并发数量。
- 不可信的 joblib 或模型制品不得反序列化，模型制品应使用安全格式或经过验证的可信来源。
- 容器镜像和依赖需要供应链固定、来源证明与定期漏洞审计。
- 浏览器端部署必须启用安全响应头等加固措施，并最小化 API 响应和日志中的敏感数据。
- Live trading 防护必须由代码和配置强制执行，包括显式授权、默认 dry-run 和风险限额检查。
- 量化研究必须使用因果特征、正确的前向标签、purged OOS、PIT 校验、基准日历对齐以及明确的缺失数据和交易成本处理。
- SOTA 研究协议只允许在证据充分时推进状态，`software_validated` 不得被表述为 SOTA、promotion 或 live eligibility。
- 前端 bearer token 不得持久化到 localStorage、通过 WebSocket 查询参数传输或在 API/UI 中回显。
- Nautica 的候选账本应采用文件锁、增量尾部索引、不可变碰撞失败和有界确定性 PBO 路径采样。
- Stockbook 纸面运行器应默认支持 shadow mode，以 canonical JSONL 记录可成交订单但不提交真实订单。
- DSH 的 compaction 适配器必须将异步返回的 `Promise<AsyncIterable>` 规范化为同步可消费流，并在摘要请求中关闭 reasoning 与 tool schemas。