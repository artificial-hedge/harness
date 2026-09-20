# Artificial Hedge Harness snapshot

Portable copy of the live DeepSeek Harness (`dsh` 0.1.2-rc.1) as customized on this Mac for Artificial Hedge (Solar Frontier / CamelStream). Taken 2026-09-20 from `~/.dsh`, `~/.local/lib/node_modules/@deepseek-ai/dsh`, launch agents, and API keys.

The **running** host is still `~/.dsh` on `127.0.0.1:3080`. This folder is a full snapshot, not a replacement of that install.

## Layout

| Path | What it is |
|---|---|
| `.env` | CamelStream, Vercel AI Gateway, DSH browser secret, MCPHub admin/JWT |
| `dsh-home/` | `~/.dsh` home: `settings.yaml`, `.credentials.yaml`, Lunar preset, `/24x7`, SSH remote, MCPHub, web profile + `compat/` plugins |
| `dsh-home/profiles/web/compat/` | Company plugins: brand, seat, mixed-crypto strip, Camel resilience, fleet pin, SSH, `/24x7` |
| `dsh-home/.agent-presets/cordis-max/` | Lunar agent (Solar Frontier persona, compaction, delegation) |
| `vendor/@deepseek-ai/dsh/` | Installed CLI package (with its `node_modules`) |
| `bin/dsh` | Run this snapshot (`DSH_HOME` = `dsh-home/`) |
| `bin/dsh-web-max` | Live-system wrapper (still points at `~/.local/bin` / `~/.dsh`) |
| `bin/artificial-hedge-harness` | Opens the live authenticated UI |
| `bin/dsh-web-from-this-copy` | Boot **this** copy’s web profile |
| `launchagents/` | `co.artificialhedge.{dsh-web,mcphub,dipcatcher-sync}` as installed |
| `extras/dsh-tui`, `extras/dsh-lark` | Side homes (tiny) |

## Keys in `.env`

- `CAMELSTREAM_API_KEY` / `CAMEL_API_KEY` — CamelStream live key (also in `dsh-home/.credentials.yaml`)
- `AI_GATEWAY_API_KEY` and aliases — Vercel AI Gateway (`vck_…`)
- `DSH_BROWSER_SESSION_SECRET` — browser cookie grant
- `ADMIN_PASSWORD` / `JWT_SECRET` — MCPHub

## Run this copy

```bash
cd /Users/vaithianathan/lspeed
source .env
./bin/dsh --version
./bin/dsh-web-from-this-copy
```

Default model is CamelStream `auto` (shown as Solar Frontier). Official DeepSeek catalog is disabled in `cordis.patch.yml`.

## Not copied (runtime bulk, not harness code)

- `~/.dsh/ssh-workspaces` (~1.1G Windows `D:\dipcatcher` clone)
- `~/.dsh/sessions` (chat transcripts)
- `~/.dsh/shop` (plugin marketplace cache)
- `~/.dsh/models`, `storages`, logs

Ask if you want those rsynced in too.
