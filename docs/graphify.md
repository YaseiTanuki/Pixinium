# Graphify

Graphify is installed as a development tool in `.tools/graphify`, separate from
the Next.js runtime. The official Python package is `graphifyy` (double y), pinned
in `scripts/graphify-requirements.txt`.

## Setup on Windows

From the repository root, with Python 3.10+ installed:

```powershell
python -m venv .tools/graphify
./.tools/graphify/Scripts/python.exe -m pip install -r scripts/graphify-requirements.txt
pnpm.cmd graphify --help
```

On macOS/Linux use `python3 -m venv .tools/graphify` and
`.tools/graphify/bin/python -m pip install -r scripts/graphify-requirements.txt`.
The Node wrapper automatically selects the correct Python executable.

## Usage

```powershell
pnpm.cmd graphify extract . --code-only
pnpm.cmd graphify query "getAccount" --budget 1000
pnpm.cmd graphify explain "getAccount"
pnpm.cmd graphify update .
pnpm.cmd graphify cluster-only . --no-label
```

The initial extraction above uses local code parsing without an LLM API key.
The SQL parser is included for local migration files; no database is queried.
`cluster-only . --no-label` generates the report and HTML without LLM labeling.
Generated artifacts live in `graphify-out/` and are ignored by Git, along with
the Python environment. Inspect `graphify-out/graph.html` for the visual graph.
Do not disable gitignore filtering when scanning the repository.

The project Codex skill is installed under `.codex/skills/graphify/` with its
reference files. Invoke `$graphify` in Codex on the next turn. `AGENTS.md` includes
the graph query workflow and retains the existing Next.js documentation rules.
The local wrapper can also be called directly: `node scripts/graphify.mjs`.

To reinstall the skill after upgrading the pinned CLI:

```powershell
pnpm.cmd graphify install --project --platform codex
```

The upstream installer emits a bare `graphify hook-check` command in
`.codex/hooks.json`; this repo uses `node scripts/graphify.mjs hook-check` to work
without global PATH changes. Preserve that command after reinstalling.

Upstream: https://github.com/Graphify-Labs/graphify
