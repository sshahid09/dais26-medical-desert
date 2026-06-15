import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ── Tests ───────────────────────────────────────────────────────────────────

let testArtifactsDir: string;
let consoleLogs: string[] = [];
let consoleErrors: string[] = [];
let pageErrors: string[] = [];
let failedRequests: string[] = [];

test('smoke test - app loads and shows the prioritization map', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Medical Desert Planner' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Prioritization map' })).toBeVisible();

  // Primary navigation
  await expect(page.getByRole('link', { name: 'Map', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Districts' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Compare', exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Methodology' })).toBeVisible();
});

test('smoke test - district rankings page loads', async ({ page }) => {
  await page.goto('/districts');
  await expect(page.getByRole('heading', { name: 'District rankings' })).toBeVisible();
});

test('smoke test - methodology page loads', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: 'Methodology & data' })).toBeVisible();
  await expect(page.getByText('Medical Desert Score')).toBeVisible();
});

// ── Lifecycle hooks ─────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  consoleLogs = [];
  consoleErrors = [];
  pageErrors = [];
  failedRequests = [];

  testArtifactsDir = join(process.cwd(), '.smoke-test');
  mkdirSync(testArtifactsDir, { recursive: true });

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (!text.trim() || /^%[osd]$/.test(text.trim())) return;
    const location = msg.location();
    const locationStr = location.url ? ` at ${location.url}:${location.lineNumber}:${location.columnNumber}` : '';
    consoleLogs.push(`[${type}] ${text}${locationStr}`);
    if (type === 'error') consoleErrors.push(`${text}${locationStr}`);
  });

  page.on('pageerror', (error) => {
    pageErrors.push(`Page error: ${error.message}\nStack: ${error.stack || 'No stack trace available'}`);
  });

  page.on('requestfailed', (request) => {
    failedRequests.push(`Failed request: ${request.url()} - ${request.failure()?.errorText}`);
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const testName = testInfo.title.replace(/ /g, '-').toLowerCase();
  const screenshotPath = join(testArtifactsDir, `${testName}-app-screenshot.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const logsPath = join(testArtifactsDir, `${testName}-console-logs.txt`);
  const allLogs = [
    '=== Console Logs ===', ...consoleLogs,
    '\n=== Console Errors (React errors) ===', ...consoleErrors,
    '\n=== Page Errors ===', ...pageErrors,
    '\n=== Failed Requests ===', ...failedRequests,
  ];
  writeFileSync(logsPath, allLogs.join('\n'), 'utf-8');

  await page.close();
});
