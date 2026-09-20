window.__ModuleLoader__.load({
  id: "ah-seat",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const h = React.createElement;
    const inject = ["slots", "locale"];
    const CONFIG_ROUTE = "/api/ah-seat/config";
    const SPEEDS = [
      { id: "ultrafast", label: "Ultrafast", hint: "4k tokens, thinking still on" },
      { id: "fast", label: "Fast", hint: "8k tokens" },
      { id: "standard", label: "Standard", hint: "16k tokens" },
      { id: "high", label: "High", hint: "32k tokens" },
      { id: "intense", label: "Intense", hint: "65k tokens" },
    ];

    const REPLACEMENTS = [
      ["camelStream Auto", "Solar Frontier"],
      ["camelstream Auto", "Solar Frontier"],
      ["camelStream", "Solar Frontier"],
      ["camelstream", "Artificial Hedge"],
      ["DeepSeek Harness", "Artificial Hedge"],
      ["DeepSeek-V4-Flash", "Solar Frontier"],
      ["Thinking Level", "Thinking"],
      ["Thinking level", "Thinking"],
      ["Into the Unknown", "Ad astra, to lightspeed!"],
      ["探索未至之境", "Ad astra, to lightspeed!"],
      ["Cordis Max", "Lunar"],
      ["Standard mode", "Orbit"],
      ["PTC mode", "Forge"],
      ["Minimal mode", "Drift"],
      ["Creator mode", "Studio"],
      ["Research mode", "Atlas"],
      ["标准模式", "Orbit"],
      ["PTC 模式", "Forge"],
      ["极简模式", "Drift"],
    ];

    function insertCss(css) {
      const tag = document.createElement("style");
      tag.dataset.dyn = "ah-seat";
      tag.textContent = css;
      document.head.append(tag);
    }

    function rewriteText(value) {
      if (!value) return value;
      let next = value;
      for (const [from, to] of REPLACEMENTS) {
        if (next.includes(from)) next = next.split(from).join(to);
      }
      return next;
    }

    function walk(node) {
      if (!node) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const rewritten = rewriteText(node.nodeValue);
        if (rewritten !== node.nodeValue) node.nodeValue = rewritten;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA") return;
      if (node.classList?.contains("pXSMma_headlineText")) {
        if (node.textContent !== "Ad astra, to lightspeed!") {
          node.textContent = "Ad astra, to lightspeed!";
        }
        return;
      }
      if (node.classList?.contains("pXSMma_previewBadge")) {
        if (node.textContent !== "Artificial Hedge") {
          node.textContent = "Artificial Hedge";
        }
        return;
      }
      for (const attr of ["aria-label", "title", "placeholder", "alt"]) {
        const current = node.getAttribute?.(attr);
        if (!current) continue;
        const rewritten = rewriteText(current);
        if (rewritten !== current) node.setAttribute(attr, rewritten);
      }
      for (const child of Array.from(node.childNodes)) walk(child);
    }

    function hideForeignModels() {
      const items = document.querySelectorAll('[role="menuitemradio"], [role="group"]');
      for (const el of items) {
        const label = `${el.getAttribute("aria-label") || ""} ${el.textContent || ""}`;
        const keep =
          /solar frontier|camelstream|artificial hedge|\bauto\b/i.test(label) &&
          !/deepseek-v4|via deepseek/i.test(label);
        const drop = /deepseek-v4|via deepseek|^deepseek$/i.test(label);
        if (drop && !keep) {
          el.style.display = "none";
          el.setAttribute("aria-hidden", "true");
        }
      }
    }

    function requestJson(method, url, body) {
      return fetch(url, {
        method,
        headers: body === undefined
          ? { accept: "application/json" }
          : { accept: "application/json", "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null);
    }

    function SpeedPill() {
      const [speed, setSpeed] = React.useState("intense");
      const [open, setOpen] = React.useState(false);
      const rootRef = React.useRef(null);

      React.useEffect(() => {
        let cancelled = false;
        requestJson("GET", CONFIG_ROUTE).then((view) => {
          if (cancelled || !view || !view.value) return;
          setSpeed(String(view.value.speed || "intense"));
        });
        return () => {
          cancelled = true;
        };
      }, []);

      React.useEffect(() => {
        if (!open) return undefined;
        const onDoc = (event) => {
          if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
      }, [open]);

      const current = SPEEDS.find((row) => row.id === speed) || SPEEDS[SPEEDS.length - 1];

      return h("div", { className: "ah-speed", ref: rootRef },
        h("button", {
          type: "button",
          className: "ah-speed-pill",
          title: "Output speed. Thinking stays independently tunable.",
          onClick: () => setOpen((value) => !value),
        },
          h("span", { className: "ah-speed-kicker" }, "SPD"),
          h("span", { className: "ah-speed-label" }, current.label),
        ),
        open
          ? h("div", { className: "ah-speed-menu", role: "menu" },
              SPEEDS.map((row) => h("button", {
                key: row.id,
                type: "button",
                role: "menuitemradio",
                "aria-checked": row.id === speed ? "true" : "false",
                className: "ah-speed-item" + (row.id === speed ? " is-on" : ""),
                onClick: () => {
                  setSpeed(row.id);
                  setOpen(false);
                  requestJson("POST", CONFIG_ROUTE, { speed: row.id });
                },
              },
                h("span", null, row.label),
                h("small", null, row.hint),
              )))
          : null,
      );
    }

    function apply(ctx) {
      insertCss(`
        [role="group"][name="DeepSeek"],
        [role="group"][aria-label="DeepSeek"] { display: none !important; }
        .ah-speed { position: relative; display: inline-flex; }
        .ah-speed-pill {
          display: inline-flex; align-items: center; gap: 6px;
          height: 28px; padding: 0 10px; border: 0.5px solid transparent;
          border-radius: 999px; background: transparent; color: var(--dsw-alias-label-secondary);
          font: 500 12px/1 var(--ah-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
          letter-spacing: 0.04em; cursor: pointer;
        }
        .ah-speed-pill:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
        .ah-speed-kicker { color: var(--ah-accent, #e11d48); font-size: 10px; letter-spacing: 0.14em; }
        .ah-speed-menu {
          position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 40;
          min-width: 220px; padding: 6px; border-radius: 12px;
          background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 92%, black);
          border: 0.5px solid var(--dsw-alias-border-l2);
          box-shadow: 0 18px 40px rgb(0 0 0 / 45%);
          display: flex; flex-direction: column; gap: 2px;
        }
        .ah-speed-item {
          display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
          width: 100%; padding: 8px 10px; border: 0; border-radius: 8px;
          background: transparent; color: var(--dsw-alias-label-primary);
          font: 500 13px/1.2 ui-sans-serif, system-ui; cursor: pointer; text-align: left;
        }
        .ah-speed-item small { color: var(--dsw-alias-label-tertiary); font: 400 11px/1.3 var(--ah-mono, ui-monospace, monospace); }
        .ah-speed-item.is-on, .ah-speed-item:hover { background: var(--dsw-alias-interactive-bg-hover); }
      `);
      document.title = "Artificial Hedge";
      walk(document.body);
      hideForeignModels();
      const observer = new MutationObserver((mutations) => {
        const nextTitle = document.title
          .replace(/DeepSeek Harness/g, "Artificial Hedge")
          .replace(/DeepSeek/g, "Artificial Hedge");
        if (nextTitle !== document.title) document.title = nextTitle;
        for (const mutation of mutations) {
          if (mutation.type === "characterData") {
            walk(mutation.target);
            continue;
          }
          for (const node of mutation.addedNodes) walk(node);
        }
        hideForeignModels();
      });
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
      });
      try {
        ctx.slots.inject("conversation.input.right", () =>
          ctx.slots.register({
            name: "conversation.input.right",
            id: "ah-speed",
            order: 40,
          }, SpeedPill),
        );
      } catch (error) {
        console.warn("[ah-seat] speed pill failed to mount:", error);
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
