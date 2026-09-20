// User-owned compatibility entry for @aydin0411/dsh-multivers 1.1.0.
// Its implementation reads webServer opportunistically but omits it from its
// Cordis inject list, so the loader rejects the published entry on this host.
// It also wraps ctx.llm.stream as an async function, which turns the LLM service
// contract from AsyncIterable into Promise<AsyncIterable>. The core
// compactor and other direct callers consume the stream synchronously, so this
// adapter always re-exposes an async generator.
import * as implementation from '../node_modules/@aydin0411/dsh-multivers/lib/index.js';

export const name = implementation.name;
export const inject = [...implementation.inject, 'webServer'];

function isAsyncIterable(value) {
  return value != null && typeof value[Symbol.asyncIterator] === 'function';
}

export function apply(ctx, config) {
  implementation.apply(ctx, config);

  const intercepted = ctx.llm?.stream?.bind(ctx.llm);
  if (!intercepted) return;

  ctx.llm.stream = async function* stream(options) {
    const result = intercepted(options);
    const iterable = isAsyncIterable(result) ? result : await result;
    if (!isAsyncIterable(iterable)) {
      throw new TypeError('dsh-multivers returned a non-async-iterable LLM stream');
    }
    yield* iterable;
  };
}
