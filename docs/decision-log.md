# Decision Log & Traceability Matrix

**Project:** Node.js → Python 3 Flask migration of the `hello_world` HTTP server.

This document is mandated by the user-specified **"Explainability" rule**: every non-trivial implementation decision is recorded here with its alternatives, rationale, and risk, and a **bidirectional traceability matrix** maps every source construct to its target implementation (and back) at **100% coverage with no gaps**. Per that rule, design rationale lives **only** in this document and is intentionally **not** duplicated in code comments in `app.py` or `requirements.txt`.

The migration replaces the Node.js runtime and its built-in `http` module with CPython 3 + Flask, preserving the core HTTP contract of the original server: status `200`, bare `Content-Type: text/plain` (no charset), body `Hello, World!\n` (14 bytes, `Content-Length: 14`), binding `127.0.0.1:3000`, and the startup log line. Every path and all seven standard HTTP methods (`GET`, `HEAD`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`) reach the single catch-all handler and receive this fixed response. A small set of residual deviations that cannot be made byte-identical purely at the Flask application layer — the Werkzeug `Server` header, the additional Werkzeug startup banner, `HEAD` response-body stripping, and truly custom/exotic HTTP verbs returning `405` — are enumerated with rationale and risk in §3 (Residual Deviations) below.

## 1. Decision Log

A row per non-trivial decision (a decision is non-trivial if a competent engineer could reasonably have chosen differently).

| # | Decision | Alternatives | Rationale | Risk |
|---|----------|--------------|-----------|------|
| 1 | Target runtime **Python 3.13.x** | Python 3.12, Python 3.14 | Mature line with broad wheel compatibility; comfortably satisfies Flask's Python ≥ 3.9 requirement | Low; 3.14 features unused |
| 2 | Framework **Flask 3.1.3** | Flask 3.0.x, 2.3.x | Latest stable at planning time; current security fixes | Low |
| 3 | Server via **Werkzeug dev server (`app.run()`)** | `gunicorn`, `waitress` | 1:1 single-process equivalent of Node's built-in server; production servers add worker/process behavior absent from the source | Dev server not hardened, but neither was the source |
| 4 | Module named **`app.py`** | `server.py` (mirrors source name) | Flask convention; enables `flask run` auto-discovery | Slightly weaker filename traceability, mitigated by the matrix in §2 |
| 5 | **Module-level app** object | Application factory (`create_app`) | Mirrors the source's module-level `server`; minimal indirection `[server.js:L6]` | None for this scope |
| 6 | **Catch-all dual route** (`/` + `/<path:path>`) | Custom WSGI wrapper, `before_request` | Idiomatic Flask; reproduces routing-free universal handling | Exotic verbs still 405 (see #11) |
| 7 | **`provide_automatic_options=False`** + explicit methods list | Rely on Flask auto-OPTIONS | Ensures `OPTIONS` returns the fixed body like Node | None |
| 8 | **`content_type='text/plain'`** (verbatim) | `mimetype='text/plain'` | Prevents Werkzeug appending `; charset=utf-8`, matching the bare source header `[server.js:L8]` | None |
| 9 | **Accept `Server` header deviation** | Custom `WSGIRequestHandler` to strip it | Header is added at the dev-server layer, not the response; stripping needs a custom handler that over-engineers a fixture | Response headers not byte-identical to Node |
| 10 | **Explicit startup `print()`** + accept Werkzeug banner | Suppress all framework output | Reproduces the Node startup line `[server.js:L13]`; the Werkzeug banner cannot be cleanly suppressed | Extra stdout lines (non-behavioral) |
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
| 4 | `http.createServer((req, res) => { … })` `[server.js:L6]` | `app = Flask(__name__)` + `catch_all` view |
| 5 | `res.statusCode = 200` `[server.js:L7]` | `Response(..., status=200)` |
| 6 | `res.setHeader('Content-Type', 'text/plain')` `[server.js:L8]` | `Response(..., content_type='text/plain')` |
| 7 | `res.end('Hello, World!\n')` `[server.js:L9]` | `Response('Hello, World!\n', ...)` |
| 8 | `server.listen(port, hostname, cb)` `[server.js:L12]` | `app.run(host='127.0.0.1', port=3000)` |
| 9 | `console.log(...)` startup log `[server.js:L13]` | `print('Server running at http://127.0.0.1:3000/')` |
| 10 | Implicit: responds to all methods and paths `[server.js:L6-L10]` | Catch-all dual route + `methods=[...]` + `provide_automatic_options=False` |
| 11 | Implicit: no `Server` header sent | Documented residual deviation (accept, or custom `WSGIRequestHandler`) |
| 12 | `package.json` metadata + empty deps `[package.json:L1-L11]` | `requirements.txt` (pins `Flask==3.1.3`) |
| 13 | `package-lock.json` empty graph `[package-lock.json:L5-L9]` | Obsolete; no target artifact |

### 2.2 Direction 2 — Target (Flask) → Source (Node.js)

Every target construct traces to an originating source construct, proving no orphan constructs exist.

| # | Target construct (Flask) | Originating source construct |
|---|--------------------------|------------------------------|
| 1 | `from flask import Flask, Response` | `require('http')` `[server.js:L1]` |
| 2 | `app = Flask(__name__)` + `catch_all` view | `http.createServer(cb)` `[server.js:L6]` |
| 3 | Catch-all routes + `methods=[...]` + `provide_automatic_options=False` | Implicit universal handling `[server.js:L6-L10]` |
| 4 | `Response('Hello, World!\n', status=200, content_type='text/plain')` | `res.statusCode` / `setHeader` / `end` `[server.js:L7-L9]` |
| 5 | `app.run(host='127.0.0.1', port=3000, debug=False, use_reloader=False)` | `server.listen(port, hostname, cb)` `[server.js:L12]` |
| 6 | `print('Server running at http://127.0.0.1:3000/')` | `console.log(...)` `[server.js:L13]` |
| 7 | `requirements.txt` (`Flask==3.1.3`) | `package.json` / `package-lock.json` `[package.json:L1-L11]` |
| 8 | `docs/decision-log.md` | **No source construct** — mandated by the "Explainability" rule |

**Coverage note:** The only target construct without a source counterpart is `docs/decision-log.md`, which exists solely to satisfy the "Explainability" rule and is annotated as such. There are no unexplained additions and no orphan source constructs — coverage is 100% in both directions.

## 3. Residual Deviations

The following table enumerates every behavior that cannot be made byte-identical purely at the Flask application layer, together with the chosen resolution and its risk. These are the residual deviations referenced in the summary above, and together they give **100% coverage of the known departures from strict Node parity**. Each is a documented, low-risk divergence. The `Server`-header, startup-banner, and exotic-verb items are also recorded as decisions #9, #10, and #11 in §1 (viewed there through the decision-making lens); they are consolidated here, alongside the `HEAD` deviation, so that all residual deviations are documented together in one authoritative place.

| # | Concern | Node behavior | Flask/Werkzeug behavior | Chosen resolution | Risk |
|---|---------|---------------|-------------------------|-------------------|------|
| 1 | `Server` response header | Not sent | `Server: Werkzeug/<ver> Python/<ver>` is added by the development server at the request-handler layer (`send_response`), not via the response object | Accept as a documented low-risk deviation; optionally override `WSGIRequestHandler` if strict header parity is ever mandated | Response headers not byte-identical to Node |
| 2 | Startup banner | Single custom line only | The Werkzeug development server prints an extra banner plus a development-server warning on stdout | Emit the Node-identical line via `print('Server running at http://127.0.0.1:3000/')`; accept the extra banner as stdout-only | Extra stdout lines (non-behavioral; does not affect HTTP responses) |
| 3 | `HEAD` request body | Body `Hello, World!\n` is written | Flask/Werkzeug runs the view for `HEAD` but strips the response body while preserving `Content-Length: 14` | Accept as a documented low-risk deviation because HTTP clients ignore `HEAD` response bodies; strict byte parity would require a custom handler | Minor; the `HEAD` response body differs from Node, but clients ignore it |
| 4 | Exotic / custom HTTP verbs | Handler runs for any verb | Routing returns `405 Method Not Allowed` for verbs not listed on the route | Enumerate the seven standard verbs (`GET`, `HEAD`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`) so all realistic verbs reach the handler; optionally add a `405` handler returning the fixed body for fuller parity | Truly custom verbs return `405`, unlike Node |
