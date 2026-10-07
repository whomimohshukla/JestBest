import { Page } from 'playwright';
import type { TestStep } from '../../types/domain.types';

const DEFAULT_TIMEOUT = 10000;

const resolveUrl = (value: string | undefined, baseUrl?: string): string => {
  if (!value) return '';
  if (!baseUrl) return value;
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
};

export interface StepExecutionResult {
  stepIndex: number;
  action: string;
  success: boolean;
  error?: string;
}

export const pageService = {
  async runSteps(page: Page, steps: TestStep[], baseUrl?: string): Promise<StepExecutionResult[]> {
    const results: StepExecutionResult[] = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const result = await pageService.executeStep(page, step, i, baseUrl);
      results.push(result);
      if (!result.success) {
        break;
      }
    }
    return results;
  },

  async executeStep(
    page: Page,
    step: TestStep,
    index: number,
    baseUrl?: string
  ): Promise<StepExecutionResult> {
    const timeout = step.timeout ?? DEFAULT_TIMEOUT;
    try {
      switch (step.action) {
        case 'goto':
          await page.goto(resolveUrl(step.value, baseUrl), { waitUntil: 'domcontentloaded', timeout });
          break;
        case 'click':
          await page.click(step.selector ?? '', { timeout });
          break;
        case 'fill':
          await page.fill(step.selector ?? '', step.value ?? '', { timeout });
          break;
        case 'press':
          await page.press(step.selector ?? '', step.value ?? 'Enter', { timeout });
          break;
        case 'waitForSelector':
          await page.waitForSelector(step.selector ?? '', { timeout });
          break;
        case 'waitForTimeout':
          await page.waitForTimeout(step.value ? Number(step.value) : 1000);
          break;
        case 'expectVisible':
          await page.waitForSelector(step.selector ?? '', { state: 'visible', timeout });
          break;
        case 'expectText': {
          const body = await page.textContent('body');
          if (!body || !body.includes(step.text ?? '')) {
            throw new Error(`Expected text "${step.text}" not found on page`);
          }
          break;
        }
        case 'screenshot':
          await page.screenshot({ type: 'png' });
          break;
        default:
          throw new Error(`Unsupported step action: ${(step as { action: string }).action}`);
      }
      return { stepIndex: index, action: step.action, success: true };
    } catch (error) {
      return {
        stepIndex: index,
        action: step.action,
        success: false,
        error: error instanceof Error ? error.message : 'Step failed',
      };
    }
  },

  async captureScreenshot(page: Page, path: string): Promise<string | null> {
    try {
      await page.screenshot({ path, type: 'png', fullPage: false });
      return path;
    } catch {
      return null;
    }
  },

  async captureConsole(page: Page): Promise<string[]> {
    const logs: string[] = [];
    try {
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          logs.push(`[${message.type()}] ${message.text().slice(0, 2000)}`);
        }
      });
      page.on('pageerror', (error) => {
        logs.push(`[pageerror] ${error.message.slice(0, 2000)}`);
      });
    } catch {
      return logs;
    }
    return logs;
  },
};
