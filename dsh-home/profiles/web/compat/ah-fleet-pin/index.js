import {
  DEFAULT_MAX_REDRAWS,
  currentPrefer,
  handleFleetCommand,
  pinnedFetch,
  writePin,
} from "./lib.js";

export const name = "ah-fleet-pin";
export const inject = ["commands"];

export function apply(ctx, config = {}) {
  const originalFetch = globalThis.fetch.bind(globalThis);
  const maxRedraws = Number.isFinite(config.maxRedraws)
    ? Math.max(0, Math.floor(config.maxRedraws))
    : DEFAULT_MAX_REDRAWS;

  globalThis.fetch = (input, init) => pinnedFetch(originalFetch, input, init, {
    getPrefer: () => currentPrefer(config),
    maxRedraws,
    onServed: (model, prefer, redraws) => {
      writePin({
        lastServed: model ?? null,
        lastPrefer: prefer,
        lastAt: new Date().toISOString(),
      });
      if (redraws > 0) {
        ctx.logger?.info?.(`ah-fleet-pin: served ${model} for ${prefer} after ${redraws} redraw(s)`);
      }
    },
    onMiss: (model, prefer, attempt) => {
      ctx.logger?.warn?.(`ah-fleet-pin: wanted ${prefer}, mixer served ${model}; redraw ${attempt}/${maxRedraws}`);
    },
    onGiveUp: (model, prefer) => {
      writePin({
        lastServed: model ?? null,
        lastPrefer: prefer,
        lastAt: new Date().toISOString(),
      });
      ctx.logger?.warn?.(`ah-fleet-pin: mixer kept serving ${model}; using it instead of ${prefer}`);
    },
  });

  ctx.effect(() => () => {
    globalThis.fetch = originalFetch;
  }, "ah-fleet-pin: restore fetch");

  ctx.effect(function* () {
    yield ctx.commands.register({
      name: "fleet",
      description: "Prefer one CamelStream fleet family (best-effort redraw; official pin needs a custom plan)",
      input: { hint: "[auto|luna|deepseek|glm|muse|status]" },
      handler: (invocation) => handleFleetCommand(invocation?.rawInput),
    });
  }, "ah-fleet-pin command");

  ctx.logger?.info?.(`ah-fleet-pin: preference ${currentPrefer(config)}, maxRedraws ${maxRedraws}`);
}
