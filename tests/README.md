# E2E Testing Guide

## Overview

This project uses Playwright for end-to-end testing with a robust, reliable test infrastructure.

## Test Structure

```
tests/
├── e2e/                          # E2E test files
│   ├── collaboration-enhanced.spec.ts
│   ├── board-interaction.spec.ts
│   ├── smoke.spec.ts
│   └── collaboration.spec.ts (legacy)
├── fixtures/                     # Test fixtures
│   └── auth.fixtures.ts         # Authentication mocking
└── helpers/                      # Test utilities
    └── test-helpers.ts          # Reusable test functions
```

## Key Features

### 1. **Test Fixtures**
- **Authenticated Page**: Automatically mocks auth session
- **Reusable across all tests**

```typescript
test('my test', async ({ authenticatedPage: page }) => {
    // page is already authenticated
});
```

### 2. **Test Helpers**

#### mockBoardAPI(page, board)
Mocks all board API endpoints for reliable testing.

#### createMockBoard(overrides)
Creates mock board data with sensible defaults.

#### navigateToBoard(page, boardId)
Navigates to a board and waits for it to be fully loaded.

#### waitForPageReady(page)
Ensures page is fully loaded with all async operations complete.

## Running Tests

### Local Development
```bash
# Run all tests
npm test

# Run specific test file
npx playwright test tests/e2e/collaboration-enhanced.spec.ts

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests in debug mode
npx playwright test --debug

# Run tests with UI
npx playwright test --ui
```

### View Test Reports
```bash
npx playwright show-report
```

## CI/CD Integration

### GitHub Actions
The CI workflow (`.github/workflows/e2e-tests.yml`) runs on:
- Push to `main` or `develop` branches
- Pull requests

**Features:**
- Installs dependencies
- Builds the application
- Runs all E2E tests
- Uploads test reports as artifacts
- Retries flaky tests automatically

### Required Secrets
Add these to your GitHub repository secrets:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `AUTH_SECRET`

## Writing New Tests

### Example: Basic Test
```typescript
import { test, expect } from '../fixtures/auth.fixtures';
import { mockBoardAPI, createMockBoard, navigateToBoard } from '../helpers/test-helpers';

test('my new test', async ({ authenticatedPage: page }) => {
    const board = createMockBoard({
        id: 'test-123',
        title: 'My Test Board'
    });

    await mockBoardAPI(page, board);
    await navigateToBoard(page, board.id);

    await expect(page.getByText('My Test Board')).toBeVisible();
});
```

### Example: Testing User Interactions
```typescript
test('should save board', async ({ authenticatedPage: page }) => {
    const board = createMockBoard({ id: 'save-test' });
    
    await mockBoardAPI(page, board);
    await navigateToBoard(page, board.id);
    
    // Perform action
    await saveBoard(page);
    
    // Verify result
    await expect(page.getByText(/Saved/i)).toBeVisible();
});
```

## Best Practices

### 1. **Always Mock API Calls**
- Use `mockBoardAPI` or custom route mocking
- Prevents flakiness from network/database issues
- Makes tests faster

### 2. **Use Fixtures for Authentication**
- Import from `../fixtures/auth.fixtures`
- Use `authenticatedPage` instead of bare `page`

### 3. **Wait for Elements Properly**
```typescript
// ✅ Good - with timeout
await expect(element).toBeVisible({ timeout: 5000 });

// ❌ Bad - arbitrary wait
await page.waitForTimeout(2000);
```

### 4. **Use Descriptive Test Names**
```typescript
// ✅ Good
test('should display error message when board fails to load')

// ❌ Bad
test('error test')
```

### 5. **Clean Up After Tests**
Playwright automatically:
- Closes pages/contexts
- Clears storage
- Resets routes

## Debugging Failed Tests

### 1. Run in Headed Mode
```bash
npx playwright test --headed --max-failures=1
```

### 2. Use Debug Mode
```bash
npx playwright test --debug
```

### 3. Check Screenshots/Videos
Failed tests automatically capture:
- Screenshots
- Videos
- Traces

Find them in `test-results/` directory.

### 4. View HTML Report
```bash
npx playwright show-report
```

## Configuration

See `playwright.config.ts` for:
- Timeout settings
- Retry configuration
- Browser options
- Reporter settings

## Reliability Features

1. **Automatic Retries**: Tests retry 1-2 times on failure
2. **Network Idle Wait**: Waits for all network requests to complete
3. **Trace on Failure**: Automatically captures trace for debugging
4. **Screenshot/Video on Failure**: Visual evidence of what went wrong
5. **Timeout Extensions**: Generous timeouts for slow operations
6. **Mock APIs**: Eliminates external dependencies

## Common Issues & Solutions

### Issue: "Element not found"
**Solution**: Add explicit wait or increase timeout
```typescript
await expect(element).toBeVisible({ timeout: 10000 });
```

### Issue: "Navigation timeout"
**Solution**: Increase `navigationTimeout` in config or use `waitForPageReady`

### Issue: "Test is flaky"
**Solution**: 
1. Check for race conditions
2. Use proper waits instead of `waitForTimeout`
3. Mock all external dependencies

## Metrics

Current test coverage:
- **Collaboration Features**: 6 tests
- **Board Interactions**: 6 tests
- **Smoke Tests**: 4 tests

**Total**: 16 comprehensive E2E tests
