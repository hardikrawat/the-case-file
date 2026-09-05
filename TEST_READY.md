# E2E Test Suite Ready

## Test Runner
- **Full E2E Suite**: `npm run test:e2e` (or `npx playwright test tests/e2e`)
- **Tier 1 (Feature Coverage)**: `npm run test:e2e:tier1` (or `npx playwright test tests/e2e/tier1`)
- **Tier 2 (Boundary & Corner Cases)**: `npm run test:e2e:tier2` (or `npx playwright test tests/e2e/tier2`)
- **Tier 3 (Cross-Feature Combinations)**: `npm run test:e2e:tier3` (or `npx playwright test tests/e2e/tier3`)
- **Tier 4 (Real-World Application Scenarios)**: `npm run test:e2e:tier4` (or `npx playwright test tests/e2e/tier4`)
- **Infrastructure Smoke Test**: `npx playwright test tests/e2e/helpers/infra-smoke.spec.ts`
- **Expected Outcome**: All tests pass with exit code 0 against a running Next.js instance connected to the remote Turso DB.

## Coverage Summary
| Tier | Count | Description |
|------|------:|-------------|
| 1. Feature Coverage | 40 | Security, Turso DB, 5 Evidence Nodes, 4 Mounted Panels, Reputation Engine |
| 2. Boundary & Corner Cases | 15 | SSRF vectors, input limits, oversized payloads, atomic rate limiting |
| 3. Cross-Feature Combinations | 32 | Fork DAG lineage, node & string physics, RBAC matrix, contribution diff/merge/reject, cumulative reputation |
| 4. Real-World Scenarios | 20 | "The Blackwood Manor Mystery" homicide case, discovery & search, dossier export roundtrip, conflict rollback |
| **Total 4-Tier Requirement Suite** | **107** | **18 test spec files across Tiers 1-4** |
| Additional Infrastructure / Integration | 41 | Smoke tests, board interactions, dashboard, and upload tests |
| **Grand Total Discovered** | **148** | **27 test spec files verified cleanly via Playwright** |

## Feature Checklist
| # | Feature Inventory Item | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Status |
|---|------------------------|:------:|:------:|:------:|:------:|:------:|
| 1 | Turso Cloud Connection | 5 | — | — | ✓ | Covered |
| 2 | Environment Configuration | 5 | — | — | ✓ | Covered |
| 3 | Schema Integrity & Sync | 5 | — | — | ✓ | Covered |
| 4 | Relational Indexes | 5 | — | — | — | Covered |
| 5 | Soft-Delete Support | 5 | — | — | ✓ | Covered |
| 6 | Eliminate Test Auth Bypass | 7 | — | — | — | Covered |
| 7 | Route Protection | 7 | — | — | — | Covered |
| 8 | Fix Signup Token Leakage | 7 | — | — | — | Covered |
| 9 | Fix Forgot-Password Leakage | 7 | — | — | — | Covered |
| 10 | Fix Password Hash Leakage | 7 | — | — | — | Covered |
| 11 | Privacy Hardening | 7 | — | — | ✓ | Covered |
| 12 | SSRF Protection in Preview | — | 6 | — | — | Covered |
| 13 | Atomic Rate Limiting | — | 3 | — | — | Covered |
| 14 | IDOR Protection | 7 | — | 5 | — | Covered |
| 15 | File Upload Hardening | — | 6 | — | — | Covered |
| 16 | Fix Build Blocker (connectMode) | 8 | — | 4 | ✓ | Covered |
| 17 | Link Evidence Node | 8 | — | 4 | ✓ | Covered |
| 18 | Node Deletion UI | 8 | — | 4 | ✓ | Covered |
| 19 | String Cutting Sync | 8 | — | 4 | ✓ | Covered |
| 20 | Board State Isolation | 8 | — | 6 | ✓ | Covered |
| 21 | Optimistic Locking & Auto-Save | 15 | — | — | 6 | Covered |
| 22 | Mount CommentsPanel | 15 | — | — | 6 | Covered |
| 23 | Mount CollaboratorsPanel | 15 | — | 5 | 6 | Covered |
| 24 | Mount VersionHistory | 15 | — | — | 6 | Covered |
| 25 | Mount ExportModal | 15 | — | — | 3 | Covered |
| 26 | Reputation Engine Wiring | 5 | — | 7 | ✓ | Covered |
| 27 | Leaderboard User Joins | 5 | — | 7 | ✓ | Covered |
| 28 | Unified Rank Titles | 5 | — | 7 | ✓ | Covered |
| 29 | Case Lineage Indicators | — | — | 6 | ✓ | Covered |
| 30 | Contribution Visual Diff | — | — | 10 | — | Covered |
| 31 | E2E Testing Track | ✓ | ✓ | ✓ | ✓ | Covered |
| 32 | Quality Gates & Audit | — | — | — | — | Gated in M5 |

## Verification Status
- **Authentication**: Zero `x-test-bypass` headers used across all test specs. All sessions use cryptographic JWE NextAuth v5 session tokens signed with `AUTH_SECRET` or direct UI login.
- **Persistence**: Verified connection and schema execution against remote Turso Cloud DB (`libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io`).
- **Static Analysis**: 0 ESLint errors/warnings (`npx eslint tests/e2e`), 0 TypeScript errors in `tests/e2e`.
- **Discovery**: `npx playwright test --list` discovers 148 tests across 27 files cleanly.
- **Infrastructure Smoke**: `npx playwright test tests/e2e/helpers/infra-smoke.spec.ts` passes 9/9.
