# Artificial Hedge Harness snapshot

Portable copy of the live DeepSeek Harness (`dsh` 0.1.2-rc.1) as customized for Artificial Hedge (Solar Frontier / CamelStream).

## Why `git clone` does not just run

A fresh clone is **not** a working install. These are the actual blockers:

1. **`node_modules` are not in git.** `vendor/@deepseek-ai/dsh` is only the CLI stubs. The web profile plugins are also missing until `pnpm install`.
2. **`npx` / `npm install @deepseek-ai/dsh` often dies with heap OOM.** Use **pnpm** and pin **0.1.2-rc.1**.
3. **The web profile used to be locked to `darwin` / `arm64`.** Windows `pnpm install` then skipped or broke native addons (onnx, sharp). That lock is now `win32`/`x64` as well.
4. **`bin/dsh` is a zsh script.** PowerShell and cmd cannot run it. Use `install.ps1` / `start.ps1`.
5. **`dsh` refuses any `DSH_*` name inside a `.env` file.** Putting `DSH_BROWSER_SESSION_SECRET` in `.env` and launching from the clone directory crashes boot. That key lives in `launch-env.ps1` now.
6. **Node must be `^22.19` or `>=24`.** “Node 22” below 22.19 fails the engine check.

## Windows 10 (the intended path)

In **PowerShell as the user who will run it** (not cmd):

```powershell
winget install Git.Git OpenJS.NodeJS.LTS
# reopen PowerShell, then:
git clone https://github.com/artificial-hedge/harness.git D:\harness
cd D:\harness
powershell -ExecutionPolicy Bypass -File .\install.ps1
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

`install.ps1` checks Node, downloads a real `tools\pnpm.exe` (it will not use npm's broken `pnpm.ps1`), then `pnpm install`s **local** `@deepseek-ai/dsh@0.1.2-rc.1` in `D:\harness` and the web profile plugins. The CLI tree is **hoisted** so Node ESM can see peers such as `@deepseek-ai/cordis-plugin-group` (those are runtime imports, even though npm listed them as peers / CLI `devDependencies`).

If you already ran an older install and `start.ps1` dies with `ERR_MODULE_NOT_FOUND`, pull and rebuild the CLI tree:

```powershell
cd D:\harness
git pull
Remove-Item -Recurse -Force node_modules, pnpm-lock.yaml -ErrorAction SilentlyContinue
powershell -ExecutionPolicy Bypass -File .\install.ps1
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

`start.ps1` runs `node node_modules\@deepseek-ai\dsh\lib\bin.js web --no-open` with `DSH_HOME` set to this clone's `dsh-home`, from `D:\dipcatcher` when that folder exists.

Open the URL it prints, including `?token=...`. Choose workspace `D:\dipcatcher`. Model is CamelStream `auto` (Solar Frontier). Official DeepSeek is disabled on purpose.

Keep that PowerShell window open. Bind is loopback only. From another machine:

```powershell
ssh -L 3080:127.0.0.1:3080 me@100.116.120.51
```

## Keys

- `.env` — CamelStream, Vercel AI Gateway, MCPHub (no `DSH_*` names)
- `launch-env.ps1` — `DSH_BROWSER_SESSION_SECRET` and `DSH_HOME`
- `dsh-home/.credentials.yaml` — CamelStream for the harness itself

## Mac (this machine)

The live host is still `~/.dsh` on `127.0.0.1:3080`. This folder is a snapshot, not a replacement.
