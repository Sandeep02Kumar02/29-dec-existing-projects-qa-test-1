# Decision Log & Traceability Matrix

**Project:** Node.js → Python 3 Flask migration of the `hello_world` HTTP server.

This document is mandated by the user-specified **"Explainability" rule**: every non-trivial implementation decision is recorded here with its alternatives, rationale, and risk, and a **bidirectional traceability matrix** maps every source construct to its target implementation (and back) at **100% coverage with no gaps**. Per that rule, design rationale lives **only** in this document and is intentionally **not** duplicated in code comments in `app.py` or `requirements.txt`.

The migration replaces the Node.js runtime and its built-in `http` module with CPython 3 + Flask, preserving the core HTTP contract of the original server: status `200`, bare `Content-Type: text/plain` (no charset), body `Hello, World!\n` (14 bytes, `Content-Length: 14`), binding `127.0.0.1:3000`, and the startup log line. As part of reproducing the source's routing-free universal handling (decision #6), Flask's implicit static route is disabled via `static_folder=None` and the built-in `path` URL converter is broadened, so that every path — **including `/static/...` and paths containing percent-encoded control characters such as CR/LF** — and all seven standard HTTP methods (`GET`, `HEAD`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`) reach the single catch-all handler and receive this fixed response; the URL map therefore contains only `/` and `/<path:path>`. Werkzeug's per-request access logging is additionally suppressed (decision #10) to preserve the source's silence (the Node server logs nothing per request). A small set of residual deviations that cannot be made byte-identical purely at the Flask application layer — the Werkzeug `Server` header, the residual Werkzeug/Flask startup banner, `HEAD` response-body stripping, truly custom/exotic HTTP verbs returning `405`, and the development server's `Connection: close` response header (versus Node's `keep-alive`) — are enumerated with rationale and risk in §3 (Residual Deviations) below.

## 1. Decision Log

A row per non-trivial decision (a decision is non-trivial if a competent engineer could reasonably have chosen differently).

| # | Decision | Alternatives | Rationale | Risk |
|---|----------|--------------|-----------|------|
| 1 | Target runtime **Python 3.13.x** | Python 3.12, Python 3.14 | Mature line with broad wheel compatibility; comfortably satisfies Flask's Python ≥ 3.9 requirement | Low; 3.14 features unused |
| 2 | Framework **Flask 3.1.3** | Flask 3.0.x, 2.3.x | Latest stable at planning time; current security fixes | Low |
| 3 | Server via **Werkzeug dev server (`app.run()`)** | `gunicorn`, `waitress` | 1:1 single-process equivalent of Node's built-in server; production servers add worker/process behavior absent from the source | Dev server not hardened, but neither was the source |
| 4 | Module named **`app.py`** | `server.py` (mirrors source name) | Flask convention; enables `flask run` auto-discovery | Slightly weaker filename traceability, mitigated by the matrix in §2 |
| 5 | **Module-level app** object | Application factory (`create_app`) | Mirrors the source's module-level `server`; minimal indirection `[server.js:L6]` | None for this scope |
| 6 | **Universal path handling** — a catch-all dual route (`/` + `/<path:path>`), `static_folder=None`, and a broadened built-in `path` converter | Custom WSGI wrapper or `before_request` for routing; keep Flask's default `/static/` route (or `static_url_path=None`); for control-character paths, an `@app.errorhandler(404)`, a distinctly-named custom converter, or path-normalizing WSGI middleware | Idiomatic Flask reproduces the source's routing-free universal handling: the dual catch-all route serves every path; `Flask(__name__, static_folder=None)` removes the implicit `/static/<path:filename>` route (a capability the source lacks) so `/static/...` also reaches `catch_all`; and overriding the built-in `path` converter's regex to `[^/][\s\S]*?` (which, unlike the default `[^/].*?`, matches newline characters) lets paths containing percent-encoded control characters — e.g. CR/LF — reach `catch_all` as well, so Flask never returns `404`. The URL rule string `/<path:path>` and the URL map (only `/` and `/<path:path>`) are unchanged | Exotic/custom HTTP verbs still return `405` (see #11) |
| 7 | **`provide_automatic_options=False`** + explicit methods list | Rely on Flask auto-OPTIONS | Ensures `OPTIONS` returns the fixed body like Node | None |
| 8 | **`content_type='text/plain'`** (verbatim) | `mimetype='text/plain'` | Prevents Werkzeug appending `; charset=utf-8`, matching the bare source header `[server.js:L8]` | None |
| 9 | **Accept `Server` header deviation** | Custom `WSGIRequestHandler` to strip it | Header is added at the dev-server layer, not the response; stripping needs a custom handler that over-engineers a fixture | Response headers not byte-identical to Node |
| 10 | **Startup output & logging parity** — explicit startup `print()`, suppress Werkzeug per-request access logs via `logging.getLogger('werkzeug').setLevel(logging.ERROR)`, and accept the residual Flask/Click banner | Suppress all framework output; leave access logs enabled and document them as an accepted residual; a per-message `logging.Filter` or a custom `WSGIRequestHandler` | Reproduces the Node startup line `[server.js:L13]` via `print('Server running at http://127.0.0.1:3000/')`; raising the `werkzeug` logger to `ERROR` removes the per-request access-log lines (and the dev-server warning, `Running on …`, and `Press CTRL+C` lines) with zero effect on HTTP responses, preserving the source's per-request silence `[server.js:L6-L10]`; the Flask/Click stdout banner (`* Serving Flask app …`, `* Debug mode: off`) is printed directly (not via the `werkzeug` logger) and cannot be suppressed by logging config, so it is accepted | Two residual Flask/Click stdout lines (non-behavioral); genuine errors (≥ `ERROR`) still surface |
| 11 | **Enumerate 7 standard HTTP methods** | Add a `405` handler returning the body; custom WSGI wrapper | Covers all realistic verbs with minimal code | Truly custom verbs return `405`, unlike Node |
| 12 | **Consolidate `server - Copy.js`** into single `app.py` | Create `app - Copy.py` duplicate | The copy is byte-identical to `server.js`; a second Flask module adds no value | Source file count not mirrored 1:1 (logged here) |
| 13 | **Retire `package.json` / `package-lock.json`** (superseded) | Retain alongside `requirements.txt` | A Python project should not carry stale npm manifests | Reversible; low |
| 14 | **`requirements.txt` pins Flask only** | Fully pinned lock of all 7 packages | Mirrors the source's minimal single-manifest intent `[package.json:L1-L11]` | Minor transitive-version drift |
| 15 | **`debug=False`, `use_reloader=False`** | Enable debug/reloader | Single-process, no auto-reload — matches Node startup | None |
| 16 | **Scope override of "Do not touch" / "structure unchanged"** | Refuse the change | The user's explicit rewrite instruction governs, scoped to the server project only `[README.md:L1-L2]` | Tension with fixture-integrity note; mitigated by leaving all non-server files untouched |
| 17 | **No config/env indirection introduced** | Add `python-dotenv` | Source hard-codes host/port `[server.js:L3-L4]`; minimal-changes | None |

## 2. Bidirectional Traceability Matrix

Per the "Explainability" rule, the matrix below maps source constructs to target implementations and back at **100% coverage with no gaps**.

### 2.1 Direction 1 — Source (Node.js) → Target (Flask)

Every source construct is accounted for.

| # | Source construct (Node.js) | Target implementation (Flask) |
|---|----------------------------|-------------------------------|
| 1 | `const http = require('http')` `[server.js:L1]` | `from flask import Flask, Response` |
| 2 | `const hostname = '127.0.0.1'` `[server.js:L3]` | `host='127.0.0.1'` argument to `app.run()` |
| 3 | `const port = 3000` `[server.js:L4]` | `port=3000` argument to `app.run()` |
| 4 | `http.createServer((req, res) => { … })` `[server.js:L6]` | `app = Flask(__name__, static_folder=None)` + `catch_all` view |
| 5 | `res.statusCode = 200` `[server.js:L7]` | `Response(..., status=200)` |
| 6 | `res.setHeader('Content-Type', 'text/plain')` `[server.js:L8]` | `Response(..., content_type='text/plain')` |
| 7 | `res.end('Hello, World!\n')` `[server.js:L9]` | `Response('Hello, World!\n', ...)` |
| 8 | `server.listen(port, hostname, cb)` `[server.js:L12]` | `app.run(host='127.0.0.1', port=3000, debug=False, use_reloader=False)` |
| 9 | `console.log(...)` startup log + implicit **no per-request logging** `[server.js:L6-L10,L13]` | `print('Server running at http://127.0.0.1:3000/')` for the startup line + `logging.getLogger('werkzeug').setLevel(logging.ERROR)` to suppress Werkzeug per-request access logs (decision #10) |
| 10 | Implicit: responds to all methods and paths `[server.js:L6-L10]` | Catch-all dual route + `methods=[...]` + `provide_automatic_options=False` + `static_folder=None` (disables the implicit `/static/<path:filename>` route) + broadened built-in `path` converter (regex `[^/][\s\S]*?`, matching control characters) so `/static/...` and control-character paths also reach `catch_all` and never `404` (decision #6) |
| 11 | Implicit: no `Server` header sent | Documented residual deviation (§3, row 1) |
| 12 | `package.json` metadata + empty deps `[package.json:L1-L11]` | `requirements.txt` (pins `Flask==3.1.3`) |
| 13 | `package-lock.json` empty graph `[package-lock.json:L5-L9]` | Obsolete; no target artifact |

### 2.2 Direction 2 — Target (Flask) → Source (Node.js)

Every target construct traces to an originating source construct, proving no orphan constructs exist.

| # | Target construct (Flask) | Originating source construct |
|---|--------------------------|------------------------------|
| 1 | `from flask import Flask, Response` | `require('http')` `[server.js:L1]` |
| 2 | `app = Flask(__name__, static_folder=None)` + `catch_all` view | `http.createServer(cb)` `[server.js:L6]` |
| 3 | Catch-all routes + `methods=[...]` + `provide_automatic_options=False` + `static_folder=None` (removes the implicit static route) + `_FullPathConverter` (a `from werkzeug.routing import PathConverter` subclass) overriding the built-in `path` converter (regex `[^/][\s\S]*?`, matches control characters) | Implicit universal handling `[server.js:L6-L10]` |
| 4 | `Response('Hello, World!\n', status=200, content_type='text/plain')` | `res.statusCode` / `setHeader` / `end` `[server.js:L7-L9]` |
| 5 | `app.run(host='127.0.0.1', port=3000, debug=False, use_reloader=False)` | `server.listen(port, hostname, cb)` `[server.js:L12]` |
| 6 | `print('Server running at http://127.0.0.1:3000/')` + `logging.getLogger('werkzeug').setLevel(logging.ERROR)` | `console.log(...)` startup log + implicit per-request silence `[server.js:L6-L10,L13]` |
| 7 | `requirements.txt` (`Flask==3.1.3`) | `package.json` / `package-lock.json` `[package.json:L1-L11]` |
| 8 | `docs/decision-log.md` | **No source construct** — mandated by the "Explainability" rule |

**Coverage note:** The only target construct without a source counterpart is `docs/decision-log.md`, which exists solely to satisfy the "Explainability" rule and is annotated as such. There are no unexplained additions and no orphan source constructs — coverage is 100% in both directions.

## 3. Residual Deviations

The following table enumerates every behavior that cannot be made byte-identical purely at the Flask application layer, together with the chosen resolution and its risk. These are the residual deviations referenced in the summary above, and together they give **100% coverage of the known departures from strict Node parity**. Each is a documented, low-risk divergence. The `Server`-header, startup-banner, and exotic-verb items are also recorded as decisions #9, #10, and #11 in §1 (with the log-suppression choice that shapes the startup-banner row captured in decision #10), viewed there through the decision-making lens; they are consolidated here, alongside the `HEAD` and `Connection`-header deviations, so that all residual deviations are documented together in one authoritative place.

| # | Concern | Node behavior | Flask/Werkzeug behavior | Chosen resolution | Risk |
|---|---------|---------------|-------------------------|-------------------|------|
| 1 | `Server` response header | Not sent | `Server: Werkzeug/<ver> Python/<ver>` is added by the development server at the request-handler layer (`send_response`), not via the response object | Accept as a documented low-risk deviation; optionally override `WSGIRequestHandler` if strict header parity is ever mandated | Response headers not byte-identical to Node |
| 2 | Startup banner & per-request logging | Single custom startup line; **no** per-request logging | Via the `werkzeug` logger the dev server emits a development-server warning, a `Running on …` line, a `Press CTRL+C to quit` line, and one access-log line **per request**; separately, Flask/Click prints `* Serving Flask app …` and `* Debug mode: off` to stdout (these do **not** pass through the logger) | Raise the `werkzeug` logger to `ERROR` (decision #10), suppressing the dev-server warning, the `Running on …`/`Press CTRL+C` lines, and **all** per-request access logs so runtime logging matches the source's silence; emit the Node-identical startup line via `print('Server running at http://127.0.0.1:3000/')`; the residual Flask/Click stdout banner cannot be removed via logging config and is accepted as stdout-only | Two residual Flask/Click stdout lines remain (non-behavioral; no effect on HTTP responses) |
| 3 | `HEAD` request body | Body `Hello, World!\n` is written | Flask/Werkzeug runs the view for `HEAD` but strips the response body while preserving `Content-Length: 14` | Accept as a documented low-risk deviation because HTTP clients ignore `HEAD` response bodies; strict byte parity would require a custom handler | Minor; the `HEAD` response body differs from Node, but clients ignore it |
| 4 | Exotic / custom HTTP verbs | The Node HTTP parser runs the handler only for methods it recognizes — e.g. `PROPFIND` → `200` with the fixed body — and rejects truly-unknown verbs before the handler with `400 Bad Request` — e.g. `FOOBAR` → `400` (verified against the Node source) | Routing returns `405 Method Not Allowed` for any verb not listed on the route — both recognized-but-unlisted verbs (e.g. `PROPFIND`) and unknown verbs (e.g. `FOOBAR`) | Enumerate the seven standard verbs (`GET`, `HEAD`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`) so all realistic verbs reach the handler; optionally add a `405` handler returning the fixed body for fuller parity | Exotic verbs return `405`, differing from Node (`200` for recognized methods such as `PROPFIND`; `400` for unknown verbs such as `FOOBAR`) |
| 5 | `Connection` response header | HTTP/1.1 keep-alive by default — sends `Connection: keep-alive` plus a `Keep-Alive: timeout=5` header (verified against the Node source) | The single-threaded Werkzeug development server closes the connection after each response and sends `Connection: close` | Accept as a documented low-risk deviation — it is inherent to the development server (the faithful single-process equivalent of Node's built-in server per decision #3) and lies outside the AAP core contract (status, `Content-Type`, `Content-Length`, body, binding, startup log) | `Connection` header differs (`close` vs Node's `keep-alive`); no effect on the status, body, or the core-contract headers of the fixed response |
