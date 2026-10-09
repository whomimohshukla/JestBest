import { pageService } from '../../../src/services/browser/pageService';
import type { Page } from 'playwright';

/**
 * Unit coverage for the browser step runner's assertion actions. The Playwright
 * `Page` is faked so these run without launching a browser; the real end-to-end
 * behaviour is exercised by the integration/run suites.
 */

type FakePage = {
  goto: jest.Mock;
  getAttribute: jest.Mock;
  textContent: jest.Mock;
  waitForSelector: jest.Mock;
  screenshot: jest.Mock;
};

const fakePage = (overrides: Partial<FakePage> = {}): FakePage => ({
  goto: jest.fn().mockResolvedValue({ status: () => 200 }),
  getAttribute: jest.fn().mockResolvedValue(null),
  textContent: jest.fn().mockResolvedValue(''),
  waitForSelector: jest.fn().mockResolvedValue(undefined),
  screenshot: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const asPage = (page: FakePage): Page => page as unknown as Page;

describe('pageService assertion actions', () => {
  describe('expectAttribute', () => {
    it('passes when the attribute contains the expected text', async () => {
      const page = fakePage({
        getAttribute: jest.fn().mockResolvedValue('/assets/sauce-backpack-1200x1500.jpg'),
      });

      const result = await pageService.executeStep(
        asPage(page),
        { action: 'expectAttribute', selector: 'img', attribute: 'src', text: 'sauce-backpack' },
        0
      );

      expect(result.success).toBe(true);
      expect(page.getAttribute).toHaveBeenCalledWith('img', 'src', expect.anything());
    });

    it('fails with both expected and actual values when the attribute differs', async () => {
      const page = fakePage({
        getAttribute: jest.fn().mockResolvedValue('/assets/sl-404.jpg'),
      });

      const result = await pageService.executeStep(
        asPage(page),
        { action: 'expectAttribute', selector: 'img[alt="Backpack"]', attribute: 'src', text: 'sauce-backpack' },
        0
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('sauce-backpack');
      expect(result.error).toContain('/assets/sl-404.jpg');
    });

    it('fails when the element has no such attribute', async () => {
      const page = fakePage({ getAttribute: jest.fn().mockResolvedValue(null) });

      const result = await pageService.executeStep(
        asPage(page),
        { action: 'expectAttribute', selector: 'a', attribute: 'href', text: '/x' },
        0
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('no attribute "href"');
    });
  });

  describe('expectStatus', () => {
    it('passes when the last navigation status matches', async () => {
      const page = fakePage({ goto: jest.fn().mockResolvedValue({ status: () => 200 }) });

      await pageService.executeStep(asPage(page), { action: 'goto', value: 'https://example.com' }, 0);
      const result = await pageService.executeStep(asPage(page), { action: 'expectStatus', value: '200' }, 1);

      expect(result.success).toBe(true);
    });

    it('fails when the endpoint returns a 5xx (real API bug)', async () => {
      const page = fakePage({ goto: jest.fn().mockResolvedValue({ status: () => 500 }) });

      await pageService.executeStep(asPage(page), { action: 'goto', value: 'https://httpbin.org/status/500' }, 0);
      const result = await pageService.executeStep(asPage(page), { action: 'expectStatus', value: '200' }, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Expected HTTP status 200 but got 500');
    });

    it('fails when no navigation happened first', async () => {
      const page = fakePage();

      const result = await pageService.executeStep(asPage(page), { action: 'expectStatus', value: '200' }, 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No navigation status recorded');
    });
  });

  describe('runSteps', () => {
    it('stops at the first failing step', async () => {
      const page = fakePage({ getAttribute: jest.fn().mockResolvedValue('/assets/sl-404.jpg') });

      const results = await pageService.runSteps(asPage(page), [
        { action: 'expectAttribute', selector: 'img', attribute: 'src', text: 'backpack' },
        { action: 'expectText', text: 'should never run' },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });

    it('reports an unsupported action', async () => {
      const page = fakePage();

      const result = await pageService.executeStep(
        asPage(page),
        { action: 'teleport' as never },
        0
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported step action');
    });
  });
});
