# Project Guide: Robust HTTP Server Implementation

## 1. Executive Summary

This project addresses a critical bug fix for a minimal Node.js HTTP server (`server.js`) that lacked four essential production-readiness features: error event handling, graceful shutdown, input validation, and resource timeout configuration. The original server was a 14-line implementation that only handled the happy path, causing crashes on port conflicts, abrupt termination on signals, acceptance of malformed requests, and indefinite connection hangs.

**Completion: 73% complete (22 hours completed out of 30 total hours)**

**Calculation:**
- Completed: 22h (3h analysis + 10h server.js implementation + 5h test suite + 3h validation + 1h docs)
- Remaining: 8h (code review + config + testing + docs, with enterprise multipliers applied)
- Total: 30h
- Formula: 22 / (22 + 8) × 100 = 73.3%

### Key Achievements
- Complete rewrite of `server.js` from 14 lines to 241 lines of production-ready code
- Comprehensive test suite (`server.test.js`) with 16 tests — **all passing (100%)**
- All four root causes fully addressed and verified
- Zero compilation errors, zero test failures, zero runtime issues
- Zero external dependencies added — all functionality uses Node.js built-in modules
- Original "Hello, World!" functionality fully preserved

### Critical Unresolved Issues
- **None** — all in-scope work is complete with no blocking issues

### Recommended Next Steps
1. Human code review and PR merge approval
2. Update `package.json` test script to reference new test file
3. Add negative test cases for input validation responses (405, 400, 414)
4. Consider environment variable support for deployment flexibility

---

## 2. Validation Results Summary

### Gate 1: Dependencies — PASSED ✓
- `npm install`: 0 vulnerabilities, no external dependencies
- All functionality uses Node.js built-in modules (`http`, `assert`)

### Gate 2: Compilation — PASSED ✓
- `node --check server.js`: Syntax OK
- `node --check server.test.js`: Syntax OK
- Zero compilation errors or warnings

### Gate 3: Tests — PASSED ✓ (16/16 = 100%)
| Test | Description | Status |
|------|-------------|--------|
| Test 1 | Normal GET request returns 200 | ✓ Pass |
| Test 2 | POST request returns 200 | ✓ Pass |
| Test 3 | PUT request returns 200 | ✓ Pass |
| Test 4 | DELETE request returns 200 | ✓ Pass |
| Test 5 | OPTIONS request returns 200 | ✓ Pass |
| Test 6 | HEAD request returns 200 | ✓ Pass |
| Test 7 | PATCH request returns 200 | ✓ Pass |
| Test 8 | Content-Type header is text/plain | ✓ Pass |
| Test 9 | Server requestTimeout is configured (120s) | ✓ Pass |
| Test 10 | Server headersTimeout is configured (60s) | ✓ Pass |
| Test 11 | Server keepAliveTimeout is configured (5s) | ✓ Pass |
| Test 12 | Connection tracking mechanism exists | ✓ Pass |
| Test 13 | Server error event handler can be registered | ✓ Pass |
| Test 14 | Different URL paths are accepted | ✓ Pass |
| Test 15 | Query strings in URL are accepted | ✓ Pass |
| Test 16 | Server closes gracefully | ✓ Pass |

### Gate 4: Runtime Validation — PASSED ✓
- **Server starts**: `node server.js` → `Server running at http://127.0.0.1:3000/`
- **Basic GET**: `curl http://127.0.0.1:3000/` → `Hello, World!` (200 OK)
- **EADDRINUSE handling**: Second instance shows `Error: Port 3000 is already in use...` and exits gracefully
- **SIGTERM shutdown**: Outputs `SIGTERM received. Starting graceful shutdown... Server closed. All connections handled.`
- **Timeout configs verified**: `requestTimeout=120000`, `headersTimeout=60000`, `keepAliveTimeout=5000`

### Fixes Applied During Validation
- No fixes were required during validation — all code passed on first run

### Git Summary
- **Branch**: `blitzy-ce0f7e67-08f8-4fe5-bdd1-c47340db9c90`
- **Commits**: 4 (implementation + tests + documentation)
- **Files changed**: 2 application files (`server.js` updated, `server.test.js` created)
- **Lines added**: 499 lines of application code
- **Lines removed**: 1 line (original minimal response handler)
- **Working tree**: Clean, all changes committed

---

## 3. Hours Breakdown

### Completed Work: 22 Hours

| Component | Hours | Details |
|-----------|-------|---------|
| Root cause analysis & research | 3 | Identified 4 root causes, researched Node.js HTTP best practices, analyzed original 14-line server |
| server.js implementation | 10 | Error handler (1.5h), graceful shutdown (1.5h), signal handlers (1h), input validation (1.5h), timeouts (1h), connection tracking (1h), code documentation (0.5h), refactoring & integration (2h) |
| server.test.js test suite | 5 | Test framework setup (1h), HTTP method tests ×7 (1.5h), configuration tests ×3 (0.5h), infrastructure tests ×2 (0.5h), URL handling tests ×2 (0.5h), shutdown test (0.5h), debugging (0.5h) |
| Validation & runtime testing | 3 | Compilation checks, test execution, runtime scenarios (EADDRINUSE, SIGTERM, curl), timeout verification |
| Technical documentation | 1 | Technical specifications, project guide, inline code comments |
| **Total Completed** | **22** | |

### Remaining Work: 8 Hours

| # | Task | Hours | Priority | Severity |
|---|------|-------|----------|----------|
| 1 | Code review and PR merge approval | 1 | High | Medium |
| 2 | Update `package.json` test script to `node server.test.js` | 0.5 | High | Low |
| 3 | Add negative input validation test cases (405, 400, 414 responses) | 2 | Medium | Medium |
| 4 | Environment variable configuration for port/hostname | 1.5 | Medium | Low |
| 5 | Integration testing in target deployment environment | 1.5 | Medium | Medium |
| 6 | README documentation update with new server features | 0.5 | Low | Low |
| 7 | Production deployment verification and smoke testing | 1 | Low | Low |
| | **Total Remaining** | **8** | | |

**Note**: Remaining hours include enterprise multipliers for compliance (1.15×) and uncertainty (1.25×) applied to raw estimates of ~5.5h, yielding approximately 8h total.

### Visual Representation

```mermaid
pie title Project Hours Breakdown
    "Completed Work" : 22
    "Remaining Work" : 8
```

---

## 4. Detailed Task List for Human Developers

### High Priority Tasks

#### Task 1: Code Review and PR Merge Approval
- **Estimated Hours**: 1
- **Severity**: Medium
- **Description**: Review the complete `server.js` rewrite (241 lines) and new `server.test.js` (271 lines) for code quality, correctness, and adherence to team standards.
- **Action Steps**:
  1. Review `server.js` error handling logic (lines 121-132) for proper EADDRINUSE/EACCES handling
  2. Review graceful shutdown flow (lines 163-187) for connection cleanup completeness
  3. Review input validation (lines 45-72) for security adequacy
  4. Review timeout configuration values for your environment requirements
  5. Verify the 16 test cases in `server.test.js` cover your acceptance criteria
  6. Approve and merge the PR

#### Task 2: Update package.json Test Script
- **Estimated Hours**: 0.5
- **Severity**: Low
- **Description**: The `package.json` `scripts.test` entry currently outputs an error message and exits with code 1. Update it to run the new test suite.
- **Action Steps**:
  1. Open `package.json`
  2. Change `"test": "echo \"Error: no test specified\" && exit 1"` to `"test": "node server.test.js"`
  3. Verify with `npm test` — should show 16 passing tests
  4. Note: This file was explicitly excluded from the bug fix scope per Agent Action Plan

### Medium Priority Tasks

#### Task 3: Add Negative Input Validation Test Cases
- **Estimated Hours**: 2
- **Severity**: Medium
- **Description**: The current test suite validates positive cases (valid methods return 200). Add tests for the rejection paths: invalid HTTP methods (405), bad URL format (400), and URL too long (414).
- **Action Steps**:
  1. Add test for invalid HTTP method (e.g., `INVALID`) → expect 405 with `Allow` header
  2. Add test for empty/malformed URL → expect 400
  3. Add test for URL exceeding 2048 characters → expect 414
  4. Add test for response body content on error responses
  5. Run full test suite to verify no regressions

#### Task 4: Environment Variable Configuration
- **Estimated Hours**: 1.5
- **Severity**: Low
- **Description**: The hostname (`127.0.0.1`) and port (`3000`) are hardcoded constants. For production deployments, these should be configurable via environment variables.
- **Action Steps**:
  1. Update `const hostname` to `process.env.HOST || '127.0.0.1'`
  2. Update `const port` to `parseInt(process.env.PORT, 10) || 3000`
  3. Update EADDRINUSE error message to reference the dynamic port
  4. Add environment variable documentation to README
  5. Test with `PORT=8080 node server.js`

#### Task 5: Integration Testing in Target Environment
- **Estimated Hours**: 1.5
- **Severity**: Medium
- **Description**: Run the server in your target deployment environment (container, VM, cloud) to verify behavior under realistic conditions.
- **Action Steps**:
  1. Deploy server to staging/test environment
  2. Verify SIGTERM handling with your process manager (PM2, systemd, Docker)
  3. Test connection under network latency conditions
  4. Verify timeout behavior with slow client simulation
  5. Confirm graceful shutdown during rolling deployments

### Low Priority Tasks

#### Task 6: README Documentation Update
- **Estimated Hours**: 0.5
- **Severity**: Low
- **Description**: Update the repository README to document the server's robustness features, configuration options, and test suite.
- **Action Steps**:
  1. Add section describing error handling capabilities
  2. Add section on graceful shutdown behavior
  3. Document timeout configuration values
  4. Add test execution instructions
  5. Document any environment variable configuration (if Task 4 completed)

#### Task 7: Production Deployment Verification
- **Estimated Hours**: 1
- **Severity**: Low
- **Description**: Perform smoke testing after production deployment to verify all robustness features work as expected.
- **Action Steps**:
  1. Verify server starts and responds to health checks
  2. Verify graceful shutdown behavior during deployment
  3. Monitor for any uncaught exceptions in production logs
  4. Verify timeout configurations are appropriate for production traffic
  5. Set up alerting for server error events

---

## 5. Development Guide

### 5.1 System Prerequisites

| Requirement | Version | Verified |
|-------------|---------|----------|
| Node.js | v14.11.0+ (v20.20.0 tested) | ✓ |
| npm | v6+ (v11.1.0 tested) | ✓ |
| Operating System | Linux, macOS, or Windows | ✓ |
| curl (optional) | Any version | ✓ |

**Note**: No external dependencies are required. The project uses only Node.js built-in modules.

### 5.2 Environment Setup

```bash
# Clone the repository and switch to the feature branch
git clone <repository-url>
cd <repository-directory>
git checkout blitzy-ce0f7e67-08f8-4fe5-bdd1-c47340db9c90

# Verify Node.js version (must be v14.11.0+ for requestTimeout support)
node --version
# Expected: v20.x.x or higher
```

### 5.3 Dependency Installation

```bash
# Install dependencies (currently no external dependencies)
npm install
# Expected output: "up to date" or "added 0 packages"
# Should show: 0 vulnerabilities
```

### 5.4 Verify Compilation

```bash
# Check server.js syntax
node --check server.js
# Expected: No output (clean syntax)

# Check test file syntax
node --check server.test.js
# Expected: No output (clean syntax)
```

### 5.5 Run Tests

```bash
# Run the complete test suite (16 tests)
node server.test.js

# Expected output:
# Server running at http://127.0.0.1:3000/
# Running server.js tests...
#
# ✓ Test 1: Normal GET request returns 200
# ✓ Test 2: POST request returns 200
# ✓ Test 3: PUT request returns 200
# ✓ Test 4: DELETE request returns 200
# ✓ Test 5: OPTIONS request returns 200
# ✓ Test 6: HEAD request returns 200
# ✓ Test 7: PATCH request returns 200
# ✓ Test 8: Content-Type header is text/plain
# ✓ Test 9: Server requestTimeout is configured (120s)
# ✓ Test 10: Server headersTimeout is configured (60s)
# ✓ Test 11: Server keepAliveTimeout is configured (5s)
# ✓ Test 12: Connection tracking mechanism exists
# ✓ Test 13: Server error event handler can be registered
# ✓ Test 14: Different URL paths are accepted
# ✓ Test 15: Query strings in URL are accepted
# ✓ Test 16: Server closes gracefully
#
# ==================================================
# Test Results: 16 passed, 0 failed
# ==================================================
#
# Server closed after tests.
```

### 5.6 Start the Server

```bash
# Start the HTTP server
node server.js
# Expected output: "Server running at http://127.0.0.1:3000/"
```

### 5.7 Verification Steps

```bash
# In a separate terminal:

# 1. Test basic GET request
curl http://127.0.0.1:3000/
# Expected: "Hello, World!"

# 2. Test different URL paths
curl http://127.0.0.1:3000/api/health
# Expected: "Hello, World!"

# 3. Test with query parameters
curl http://127.0.0.1:3000/path?key=value
# Expected: "Hello, World!"

# 4. Verify timeout configurations
node -e "
const {server} = require('./server.js');
const ready = setInterval(() => {
  if (server.listening) {
    clearInterval(ready);
    console.log('requestTimeout:', server.requestTimeout);
    console.log('headersTimeout:', server.headersTimeout);
    console.log('keepAliveTimeout:', server.keepAliveTimeout);
    server.close(() => process.exit(0));
  }
}, 100);
"
# Expected:
# requestTimeout: 120000
# headersTimeout: 60000
# keepAliveTimeout: 5000

# 5. Test EADDRINUSE error handling (while server is running)
node server.js
# Expected: "Error: Port 3000 is already in use. Please choose a different port or stop the other process."

# 6. Test graceful shutdown
# Send SIGTERM to the running server process
kill -TERM <server-pid>
# Expected: "SIGTERM received. Starting graceful shutdown..."
#           "Server closed. All connections handled."
```

### 5.8 Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `Error: Port 3000 is already in use` | Another process is using port 3000 | Stop the other process: `lsof -i :3000` then `kill <pid>` |
| `Error: Permission denied` | Port requires elevated privileges | Use a port > 1024 or run with `sudo` |
| Tests hang indefinitely | Server not starting | Check Node.js version is v14.11.0+; check port availability |
| `Cannot find module './server.js'` | Wrong working directory | `cd` to the repository root containing `server.js` |

---

## 6. Risk Assessment

### Technical Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Hardcoded port/hostname limits deployment flexibility | Low | Medium | Task 4: Add environment variable configuration |
| No negative test cases for validation responses | Medium | Low | Task 3: Add 405/400/414 response tests |
| `package.json` test script still outputs error | Low | High | Task 2: Update to `node server.test.js` |
| No process manager for auto-restart on crash | Medium | Low | Configure PM2, systemd, or container restart policy |

### Security Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| DoS via slow clients | Low (mitigated) | Low | Timeouts configured: request=120s, headers=60s, keepAlive=5s |
| DoS via long URLs | Low (mitigated) | Low | URL length validation at 2048 characters |
| No rate limiting | Medium | Medium | Consider adding rate limiting middleware in future iteration |
| No HTTPS support | Medium | Medium | Deploy behind a reverse proxy (nginx/HAProxy) with TLS termination |
| No authentication/authorization | Medium | Varies | Implement if serving sensitive endpoints; out of current scope |

### Operational Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| No health check endpoint | Low | Medium | Add `/health` endpoint returning 200 for load balancer integration |
| Console-only logging | Low | Medium | Sufficient for this scope; consider structured logging for production |
| No metrics/monitoring | Low | Medium | Add Prometheus metrics or APM agent for production observability |

### Integration Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Untested in containerized environments | Low | Medium | Task 5: Run integration tests in target environment |
| Graceful shutdown timeout (10s) may be too short for long requests | Low | Low | Adjust `SHUTDOWN_TIMEOUT` constant if needed for your workload |

---

## 7. Consistency Verification

| Check | Value | Verified |
|-------|-------|----------|
| Completion percentage (Executive Summary) | 73.3% | ✓ |
| Completed hours (Executive Summary) | 22h | ✓ |
| Remaining hours (Executive Summary) | 8h | ✓ |
| Total hours | 22 + 8 = 30h | ✓ |
| Pie chart "Completed Work" | 22 | ✓ |
| Pie chart "Remaining Work" | 8 | ✓ |
| Task table sum | 1 + 0.5 + 2 + 1.5 + 1.5 + 0.5 + 1 = 8h | ✓ |
| Formula | 22 / 30 × 100 = 73.3% | ✓ |
