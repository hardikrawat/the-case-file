## 2026-09-04T21:23:00+05:30

You are the Worker for verifying and finalizing the E2E test suite for 'The Case File'.
Your working directory is `/Users/hardikrawat/Documents/the-case-file/.agents/worker_e2e_gen2_1`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You MUST read the following files before starting:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_e2e_gen2/SCOPE.md`

Your tasks:
1. Audit the existing test files in `tests/e2e/helpers/*`, `tests/e2e/tier1/*`, `tests/e2e/tier2/*`, `tests/e2e/tier3/*`, and `tests/e2e/tier4/*`.
2. Ensure strictly ZERO `x-test-bypass` headers are used anywhere. Check with grep across `tests/e2e` and `playwright.config.ts`.
3. Check `package.json` scripts:
   Currently `package.json` has:
   `"test:e2e:tier1": "playwright test tests/e2e/tier1-features"`
   `"test:e2e:tier2": "playwright test tests/e2e/tier2-boundary"`
   `"test:e2e:tier3": "playwright test tests/e2e/tier3-cross-feature"`
   `"test:e2e:tier4": "playwright test tests/e2e/tier4-scenarios"`
   while the directories on disk are `tests/e2e/tier1`, `tests/e2e/tier2`, `tests/e2e/tier3`, `tests/e2e/tier4`.
   Update `package.json` scripts to target `tests/e2e/tier1`, `tests/e2e/tier2`, `tests/e2e/tier3`, `tests/e2e/tier4` (or create symlinks if needed so both naming schemes work). Ensure `npm run test:e2e`, `npm run test:e2e:tier1`, `npm run test:e2e:tier2`, `npm run test:e2e:tier3`, and `npm run test:e2e:tier4` all work.
4. Run `npx playwright test --list` to verify that all test specs are discovered cleanly without parse, syntax, or module import errors. Document the list of discovered test files and test case counts.
5. Run TypeScript check (`npx tsc --noEmit`) and ESLint (`npm run lint` or `npx eslint tests/e2e`) to verify all test files have zero errors. Fix any typing or linting errors in the test files or helpers if found.
6. Verify `npx playwright test tests/e2e/helpers/infra-smoke.spec.ts` passes against the Turso DB.
7. Write your complete findings, verification commands, and outputs to `/Users/hardikrawat/Documents/the-case-file/.agents/worker_e2e_gen2_1/handoff.md`.
8. Send a message to parent sub-orchestrator when finished.
