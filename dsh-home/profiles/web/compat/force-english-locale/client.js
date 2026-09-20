window.__ModuleLoader__.load({
  id: "force-english-locale",
  factory: () => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const inject = ["locale"];

    const ZH_TO_EN = [
      ["记忆", "Memory"],
      ["未选择", "none selected"],
      ["选择本会话的 conda / 独立 R / WSL / 手动路径环境", "Choose this session's conda / standalone R / WSL / manual-path environment"],
      ["探索未至之境", "Ad astra, to lightspeed!"],
    ];

    function rewrite(value) {
      if (!value) return value;
      let next = value;
      for (const [from, to] of ZH_TO_EN) {
        if (next.includes(from)) next = next.split(from).join(to);
      }
      return next;
    }

    function walk(node) {
      if (!node) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const rewritten = rewrite(node.nodeValue);
        if (rewritten !== node.nodeValue) node.nodeValue = rewritten;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.tagName === "SCRIPT" || node.tagName === "STYLE") return;
      for (const child of Array.from(node.childNodes)) walk(child);
    }

    function apply(ctx) {
      try {
        ctx.locale.setLocale("en");
      } catch {
        /* locale service may not be ready on the first tick */
      }
      document.documentElement.lang = "en";
      walk(document.body);
      const observer = new MutationObserver(() => walk(document.body));
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
