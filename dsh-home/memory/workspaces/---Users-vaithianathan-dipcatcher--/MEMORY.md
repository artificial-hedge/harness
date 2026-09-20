## 安全基线

- 未鉴权服务禁公网
- MLflow仅私网或鉴权
- 路径须工作区白名单
- 作业限制输入、超时、并发
- 禁载入不可信模型
- 镜像依赖须锁定溯源
- 定期执行漏洞审计
- 浏览器启用安全响应头
- 日志响应最小化敏感数据
- 实盘须授权、默认仿真
- 实盘强制风险限制
- Docker当前以root运行
- Docker构建缺少uv.lock
- 依赖下界过于宽泛

## 量化基线

- HAR-RV曾泄漏当期RV
- 优化器曾忽略风险约束
- 缺执行日会清零持仓
- ES曾错误处理离散尾部
- 分位ES曾忽略间距端点
- DCC复杂度为O(T·N³)
- 行切分曾重叠前向标签
- 排名曾误用验证集
- DCC曾接受失败优化
- GARCH曾重复开平方
- HMM曾使用未来观测

## 量化修复

- HAR特征严格滞后
- HMM默认因果过滤
- 平滑模式显式开启
- Purge与embargo按区间执行
- Walk-forward测试集不重叠
- Gold缓存执行PIT校验
- 标签按交易日历对齐
- 回测使用路径最大回撤
- 使用前向实现波动率
- ES采用经验尾部积分
- 优化器强制约束检查
- 缺价回测稳健处理
- Trainer显式声明目标
- 标签名解析预测期限

## 验证基线

- 2026-09-16通过1719项测试
- Ruff、mypy检查通过
- `uv lock --check`通过
- `git diff --check`通过
- Doctor对无效凭据拒绝
- Doctor对未授权实盘拒绝
- 不引入实盘经纪商
- 不声明实盘成交绩效
- 纸面续跑保留完整收据
- 收据恢复校验并去重
- 旧状态文件兼容计数器
- 回归覆盖拆分与连续运行
- Ranker按共同日期比较

## 审计产物

- 安全画布：`/Users/vaithianathan/.cursor/projects/dipcatcher/canvases/security-red-flags.canvas.tsx`
- 量化画布：`/Users/vaithianathan/.cursor/projects/dipcatcher/canvases/quantitative-performance-red-flags.canvas.tsx`

## 2026-09-17
GARCH production-readiness audit (2026-09-17): `GARCHVol.predict` currently ignores input rows and repeats one h=1 scalar; current fitted test codifies this. Read-only plan requires seeded GARCH/GJR/EGARCH DGP recovery, explicit causal origin/horizon forecasts with closed-form multi-step recursion and percent-unit conversion, predictive normal/t/skewt CDF/PIT and tail calibration, future-mutation leakage invariance, rolling/expanding OOS h=1/5/10/20 with fold-level QLIKE/CRPS/coverage/DM, and benchmark catalog expansion beyond rolling/EWMA. Preserve and expose fallback/convergence diagnostics; synthetic evidence remains research-only.

## 2026-09-17
Volatility architecture trace (2026-09-17): GARCH training currently consumes future_realized_var_5 as if it were a return series, fits flattened cross-sectional panel rows, ignores x, repeats one scalar forecast across each fold, and returns sigma while train QLIKE expects variance. Training writes metadata/vol_<model>.joblib and logs QLIKE but does not attach artifacts or promote aliases. Operational forecast_asof, backtest risk gate, and transaction costs consume feature vol_20 instead of the trained artifact. Any SOTA upgrade must define per-asset causal series, explicit variance/sigma units and horizon semantics, rolling OOS/probabilistic calibration evidence, and an end-to-end artifact consumer contract.

## 2026-09-17
Read-only volatility audit conclusion (2026-09-17): `train_volatility` sends `future_realized_var_5` to `GARCHVol.fit`, which ignores x and models the forward variance label as percent returns, while `predict` emits repeated one-step sigma and QLIKE receives it as variance. This is the primary blocker to interpreting GARCH results. Additional gaps: horizon-aware recursive forecasts, full higher-order/asymmetric persistence and convergence diagnostics, finite/stability gates, APARCH/FIGARCH/realized-family support, distribution calibration, and overlap-aware DM/HAC. Targeted `.venv/bin/pytest` GARCH tests passed 30 tests but do not cover production semantics.

## 2026-09-17
GARCH-family implementation status (2026-09-17): `GARCHVol` now provides causal decimal-return fitting, GARCH/GJR/EGARCH variants, normal/Student-t/skew-t innovations, decimal variance forecasts, cumulative multi-step variance, quantiles, PIT, diagnostics, convergence/persistence gates, fail-closed fallback, and joblib persistence coverage. `train_volatility` aggregates finite `ret_1` panel rows into an ordered date-level equal-weight univariate series; it never concatenates securities or fits `future_realized_var_h`. Validation: focused GARCH, training, walk-forward, Ruff, mypy, and diff checks pass. The broad non-network suite was attempted but terminated at 51% with exit 143 and is not claimed green. Remaining production gaps are per-asset artifact semantics, per-origin expanding forecasts, live consumer wiring, benchmark/registry promotion, and additional DGP/calibration evidence.

## 2026-09-17
- 波动率训练约定将 `future_realized_var_h` 仅用于评估，预测输出统一包含小数方差、波动率及与 horizon 匹配的累计方差，并明确当前实现不代表 SOTA 或实盘表现。

## 2026-09-17
Read-only GARCH audit (2026-09-17): train_volatility fits one fold-level return series and repeats one cumulative h-step forecast over all test rows; this is not an origin-aware one-step OOS path. GARCH fallback quantiles/PIT use Gaussian math even when configured t/skewt. Model units are explicitly decimal variance at API boundary, but direct fit defaults to y if returns is omitted. Training logs MLflow runs and saves joblib without registry registration/alias; docs mark artifacts research-only and disconnected from risk consumers.

## 2026-09-17
API boundary hardening: `src/quant_fund/api/app.py` now rejects malformed or oversized request bodies at 64 KiB before route work, enforces the limit while streaming, and forbids unknown fields plus caps config path length in optimize/backtest request models. `tests/unit/test_cli_api.py` covers oversized-body rejection and strict schema behavior. Readiness matrix records the request cap and strict schemas as API security controls.

## 2026-09-17
The volatility training contract now evaluates GARCH forecasts per test-date origin. `_garch_oos_predictions` in `src/quant_fund/pipeline/train.py` refits each origin using only dates strictly earlier than the origin, aggregates causal returns through the existing callback, preserves original test-row order, validates finite horizon forecasts, and returns per-origin fit statuses. Regression coverage lives in `tests/unit/test_train_walk_forward_branches.py`; model-card and SOTA gap docs state the contract. Targeted training, GARCH, volatility, Ruff, mypy, and diff checks pass.

## 2026-09-17
Sparse/asynchronous validation now preserves observed-row label endpoints: `build_labels` emits `label_end_time_{h}`, `purge_mask` accepts explicit endpoints, date-level walk-forward folds conservatively use the maximum endpoint per decision date, and all primary training paths pass aligned endpoint arrays. Cache documentation now describes digest-bound keys with metadata guards.

## 2026-09-17
GARCH training contract (2026-09-17): `_garch_return_history` aggregates finite decimal `ret_1` values by date from the full feature panel before supervised label filtering. Persisted fits include latest usable returns even when forward labels are structurally null; OOS origins select only return dates strictly earlier than each test date. Walk-forward short-sample fallback now uses explicit row-aligned `label_end_time_{h}` endpoints, aggregated conservatively by decision date, rather than session-bar arithmetic when sparse endpoints exist. Regression coverage lives in `tests/unit/test_train_walk_forward_branches.py` and `tests/unit/test_pipeline_training.py`.

## 2026-09-17
- GARCH 工件必须通过 `series_scope` 标识训练范围，直接模型默认 `univariate_return_series`，流水线池化模型使用 `date_level_equal_weight_cross_section`。

## 2026-09-17
- `NEXT_OPEN` 估值契约明确禁止交易前消费同一根 K 线的收盘标记，收盘标记仅在成交后用于后交易估值。

## 来自 项目文件(项目约定(CLAUDE.md 等)) — 接入于 2026-09-19 [链接模式]
  - /Users/vaithianathan/lightspeed/AGENTS.md
- 用法: 需要时用 memory_read 或直接读取上述路径按需获取, 不整段写入。

## 2026-09-19
Paper/shadow reliability now enforces a durable cursor invariant: `broker_state.step > 0` requires an existing non-empty `equity.parquet` with exactly the same row count; missing or empty equity fails closed, while legitimate step-zero empty runs remain valid. Resume checks this invariant before mutating the ledger. Focused evidence is captured under `.dsh-24x7/`, with industry-grade and SOTA proof intentionally still `NOT PROVEN`.

## 2026-09-19
- 当前行业级与 SOTA 证明门槛仍为 `STATUS: NOT PROVEN`，合成基准不能替代真实竞品测量和可复现的公开 SOTA 证据。