// 面板桥的浏览器侧接线（纯逻辑，可在 Node 里单测）。
//
// 职责边界：
// - 引擎（派生仓 wasm）导出 `craft_submit` / `craft_take_reply` / `craft_idle` / `craft_catalog`；
// - 本模块把它们包成一个稳定的小接口，供面板与宿主调用，并统一错误信封；
// - **不做业务判断**：命令是否合法由引擎回答，这里只做形状校验与转发。

/** 面板桥对外的接口。 */
export function createEditorBridge(engine, { maxPending = 32 } = {}) {
  if (!engine || typeof engine.craft_submit !== 'function') {
    throw new Error('createEditorBridge needs the engine wasm module (craft_submit missing)');
  }

  /** 提交一条命令；返回是否被引擎接受。 */
  function submit(request) {
    const text = typeof request === 'string' ? request : JSON.stringify(request);
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { accepted: false, reason: 'invalid_json' };
    }
    if (!parsed || typeof parsed.id !== 'string' || !parsed.id) {
      return { accepted: false, reason: 'missing_id' };
    }
    if (typeof parsed.command !== 'string' && typeof parsed.id_command !== 'string') {
      return { accepted: false, reason: 'missing_command' };
    }
    if (parsed.params !== undefined && (parsed.params === null || typeof parsed.params !== 'object' || Array.isArray(parsed.params))) {
      return { accepted: false, reason: 'bad_params' };
    }
    const accepted = Boolean(engine.craft_submit(text));
    return accepted ? { accepted: true } : { accepted: false, reason: 'queue_full' };
  }

  /** 取一条回复（已解析）；没有则返回 null。 */
  function poll() {
    const raw = engine.craft_take_reply();
    if (raw === undefined || raw === null || raw === '') return null;
    try {
      return JSON.parse(raw);
    } catch {
      return { id: '', ok: false, error: { code: 'bad_reply', message: String(raw) } };
    }
  }

  /** 队列与在途都空时返回 true。 */
  function idle() {
    return Boolean(engine.craft_idle());
  }

  /** 命令目录（解析后的对象）。 */
  function catalog() {
    const raw = engine.craft_catalog();
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed?.commands) ? parsed : { commands: [] };
  }

  /** 轮询到 `timeoutMs` 或拿到回复为止；用于"提交后等结果"的简单调用点。 */
  async function run(request, { timeoutMs = 10000, intervalMs = 20 } = {}) {
    const submitted = submit(request);
    if (!submitted.accepted) {
      const id = typeof request === 'object' && request ? request.id ?? '' : '';
      return { id, ok: false, error: { code: 'rejected', message: submitted.reason ?? 'rejected' } };
    }
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const reply = poll();
      if (reply) return reply;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    const id = typeof request === 'object' && request ? request.id ?? '' : '';
    return { id, ok: false, error: { code: 'timeout', message: `no reply within ${timeoutMs} ms` } };
  }

  return { submit, poll, idle, catalog, run, maxPending };
}
