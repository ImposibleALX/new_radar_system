# Testing Guide

This project uses:

- `vitest` for fast unit tests (`tests/unit`)
- `playwright` for end-to-end tests (`tests/integration`)
- `typescript` + strict checks
- `prettier` and `eslint` for consistency and quality

## Commands

- `npm run typecheck`: static TypeScript validation
- `npm run lint`: lint source and tests
- `npm run test:unit`: run unit tests once
- `npm run test:unit:watch`: watch-mode unit tests
- `npm run test:unit:coverage`: unit tests with text/lcov/html coverage output
- `npm run test:e2e`: run Playwright E2E suite
- `npm run test:e2e:debug`: interactive Playwright debugging
- `npm run test:e2e:repeat`: repeat E2E tests to detect flakiness
- `npm run test`: run unit + E2E
- `npm run test:ci`: CI pipeline (typecheck + lint + coverage + E2E)

## Playwright notes

- Local runs use Vite dev server via `webServer`.
- CI runs build + preview for production-like behavior.
- Retries are enabled only in CI.
- Failure artifacts:
  - trace: `on-first-retry`
  - screenshot: `only-on-failure`
  - video: `retain-on-failure`
- HTML report is generated in `playwright-report/`.

## Stable selectors

E2E tests prefer `data-testid` selectors for critical controls and overlays.
Use them for new UI elements to avoid brittle tests.

## Determinism practices

- Keep tests focused and small.
- Avoid fixed sleeps.
- Prefer explicit waits and state assertions (`expect(...)` / `expect.poll(...)`).
- Unit setup (`tests/unit/setup.ts`) auto-restores mocks and timers after each test.
