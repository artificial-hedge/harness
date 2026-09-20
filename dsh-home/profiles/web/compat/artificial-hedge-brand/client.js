window.__ModuleLoader__.load({
  id: "artificial-hedge-brand",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");

    const inject = ["slots", "locale"];
    const WORDMARK = "data:image/png;base64,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";
    const ICON_FONT = "data:font/woff2;base64,d09GMgABAAAAAAHEAAoAAAAABBAAAAF6AAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmAANApcaQE2AiQDCAsGAAQgBYM8BykbYwPInoNxm5wszBHTWPi/8UXY0uqaCKhlqyfcElJWZBeSS5rySSjKk8tTKBSUxxgKF4VBnqJQuPjRgHOtQuRAZgMZaKRFxoPhB0AVcvu8t3hbAQf0gdO91K4TT8CygXVRfgHOE55QoAUYRd7unLY2hdo/lyl5HI+Uw+GtUkK4KMmi0Yis3oZyKIeE/3PSoAcAYBAiElqTgNZskCwLlMP//+V6CAAiyCjQyQCQAUUOrSOXpAJlVw5SYqK37b99/DiJ99n2JSd19SNuhtv9lgABga199XK7YelDCPQfB2PXd7w+/y18e7qL35IIAuua3zhLKUFqiug6nwREnQWIVFXrUgBBO0NUoR1Jfx+fUVJjUV3oXUMLWSSCiT1AVO8cydIVn1HS/iIV5t5vVcnGbnUe1PLpn9WMRg70z9rD7NRMl0su6cp/SGhGs0KqECkEatiQiGUS2BTptCa6RGZRCwwtQRpbImRyvPOYnZqZFnKfrZQVFLW9LkQqyAEAAAA=";

    function insertCss(css) {
      const tag = document.createElement("style");
      tag.dataset.dyn = "artificial-hedge-brand";
      tag.textContent = css;
      document.head.append(tag);
    }

    function Mark(props) {
      const size = Number(props && props.size) || 24;
      return React.createElement("span", {
        className: "ah-brand-mark",
        style: { fontSize: Math.max(16, size) + "px" },
        role: "img",
        "aria-label": "Artificial Hedge"
      }, "\uE001");
    }

    function Name() {
      return React.createElement("img", {
        className: "ah-brand-wordmark",
        src: WORDMARK,
        alt: "Artificial Hedge"
      });
    }

    function HeroMark(props) {
      const size = Number(props && props.size) || 48;
      return React.createElement("span", {
        className: "ah-hero-mark",
        style: { fontSize: Math.max(24, size) + "px" },
        role: "img",
        "aria-label": "Artificial Hedge"
      }, "\uE001");
    }

    function IntensityRail() {
      const [samples, setSamples] = React.useState(() => Array(36).fill(0.08));
      React.useEffect(() => {
        let last = 0;
        const readChars = () => {
          const root = document.querySelector("[data-conversation-scroll], [data-phase]");
          return root ? (root.innerText || "").length : 0;
        };
        last = readChars();
        const id = window.setInterval(() => {
          const next = readChars();
          const delta = Math.max(0, next - last);
          last = next;
          const spike = Math.min(1, delta / 280);
          setSamples((prev) => {
            const decayed = prev.map((value) => value * 0.86);
            decayed.push(Math.max(0.05, spike));
            return decayed.slice(-36);
          });
        }, 700);
        return () => window.clearInterval(id);
      }, []);
      const w = 132;
      const h = 28;
      const points = samples.map((value, index) => {
        const x = (index / Math.max(1, samples.length - 1)) * (w - 2);
        const y = h - 3 - value * (h - 8);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
      const peak = samples[samples.length - 1] || 0;
      return React.createElement("div", {
        className: "ah-intensity",
        title: "Coding intensity",
        "aria-label": "Coding intensity",
      },
        React.createElement("span", { className: "ah-intensity-kicker" }, "INT"),
        React.createElement("svg", {
          className: "ah-intensity-plot",
          viewBox: `0 0 ${w} ${h}`,
          width: w,
          height: h,
          "aria-hidden": "true",
        },
          React.createElement("polyline", {
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "1.4",
            strokeLinejoin: "round",
            strokeLinecap: "round",
            points,
          }),
        ),
        React.createElement("span", { className: "ah-intensity-read" },
          String(Math.round(peak * 99)).padStart(2, "0")),
      );
    }

    function apply(ctx) {
      document.title = "Artificial Hedge";
      document.documentElement.dataset.ahShell = "lunar";
      insertCss(`
        @font-face {
          font-family: "Artificial Hedge Icons";
          src: url(${ICON_FONT}) format("woff2");
          font-display: block;
        }
        :root, html, body, body[data-ds-dark-theme] {
          --ah-accent: #e11d48;
          --ah-accent-soft: color-mix(in srgb, #e11d48 22%, transparent);
          --ah-ink: #f4f1ea;
          --ah-muted: #9a9388;
          --ah-void: #070708;
          --ah-panel: #101012;
          --ah-mono: "SFMono-Regular", "IBM Plex Mono", ui-monospace, Menlo, monospace;
          --ah-serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
          --dsw-alias-bg-base: #070708;
          --dsw-alias-bg-layer-1: #101012;
          --dsw-alias-label-primary: #f4f1ea;
          --dsw-alias-state-business-primary: #e11d48;
          --dsw-alias-label-primary-bluish: #f4f1ea;
        }
        html, body {
          background: var(--ah-void) !important;
          color: var(--ah-ink);
        }
        body::before {
          content: "";
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 1;
          opacity: 0.09;
          background-image: repeating-linear-gradient(
            to bottom,
            rgb(255 255 255 / 6%) 0px,
            rgb(255 255 255 / 6%) 1px,
            transparent 1px,
            transparent 3px
          );
          mix-blend-mode: overlay;
        }
        body::after {
          content: "";
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 1;
          opacity: 0.18;
          background:
            radial-gradient(1200px 480px at 12% -10%, rgb(225 29 72 / 18%), transparent 55%),
            radial-gradient(900px 520px at 100% 110%, rgb(255 255 255 / 4%), transparent 50%);
        }
        .ah-brand-mark, .ah-hero-mark {
          font-family: "Artificial Hedge Icons", sans-serif;
          font-weight: 400;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--ah-ink);
          speak: never;
          animation: ah-mark-in 640ms cubic-bezier(.2,.8,.2,1) both;
        }
        .ah-brand-mark { width: 24px; height: 24px; }
        .ah-hero-mark { width: 1em; height: 1em; color: var(--ah-accent); }
        .ah-brand-wordmark {
          display: block;
          width: min(168px, 100%);
          height: auto;
          max-height: 22px;
          object-fit: contain;
          object-position: left center;
          filter: contrast(1.08);
        }
        .pXSMma_headlineText {
          font-family: var(--ah-serif) !important;
          font-style: italic;
          font-weight: 400 !important;
          letter-spacing: -0.03em;
          font-size: 34px !important;
          line-height: 1.05 !important;
        }
        .pXSMma_previewBadge {
          border-color: var(--ah-accent) !important;
          background: var(--ah-accent-soft) !important;
          color: var(--ah-ink) !important;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-size: 10px !important;
        }
        .pXSMma_fishHitbox svg:not(.ah-hero-mark) { display: none !important; }
        [data-dsh-mcphub-entry],
        .mh-entry,
        [data-dam-sidebar-btn],
        [data-dam-panel] {
          display: none !important;
        }
        .Sixlwa_contextRow,
        .XrJvXW_root,
        [data-context-injection-body] {
          display: none !important;
        }
        .lcKema_root:not([data-state=running]):not([data-expanded]):has(.lcKema_summaryText:empty) {
          display: none !important;
        }
        .ah-intensity {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          min-height: 36px;
          padding: 4px 8px 8px;
          color: var(--ah-accent);
        }
        .ah-intensity-kicker {
          font: 500 10px/1 var(--ah-mono);
          letter-spacing: 0.16em;
          color: var(--ah-muted);
        }
        .ah-intensity-plot { flex: 1; display: block; }
        .ah-intensity-read {
          font: 500 11px/1 var(--ah-mono);
          color: var(--ah-ink);
          min-width: 1.5em;
          text-align: right;
        }
        @keyframes ah-mark-in {
          from { opacity: 0; transform: translateY(6px) scale(0.92); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          body::before, .ah-brand-mark, .ah-hero-mark { animation: none; }
        }
      `);
      const slots = ctx.slots;
      slots.inject("sidebar.brand.mark", () => slots.inject("sidebar.brand.name", function* () {
        yield slots.register({ name: "sidebar.brand.mark" }, Mark);
        yield slots.register({ name: "sidebar.brand.name" }, Name);
      }));
      slots.inject("conversation.hero.brand.mark", () =>
        slots.register({ name: "conversation.hero.brand.mark" }, HeroMark));
      slots.inject("sidebar.footer.action", () =>
        slots.register({
          name: "sidebar.footer.action",
          id: "ah-intensity",
          order: 1,
          label: "Intensity",
        }, IntensityRail));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
