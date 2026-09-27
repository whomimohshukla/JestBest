import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { logger } from '../../config/logger';

export interface PageSnapshot {
  url: string;
  title: string | null;
  links: string[];
  components: Array<{ name: string | null; selector: string; type: string }>;
  text: string;
}

export interface WorkflowSnapshot {
  name: string;
  steps: unknown[];
}

let browser: Browser | null = null;

const getBrowser = async (): Promise<Browser> => {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
};

const getSelectorFor = async (element: any): Promise<string> => {
  try {
    // Try to get a stable selector
    const id = await element.getAttribute('id');
    if (id) return `#${id}`;
    
    const dataTestId = await element.getAttribute('data-testid');
    if (dataTestId) return `[data-testid="${dataTestId}"]`;
    
    const name = await element.getAttribute('name');
    if (name) return `[name="${name}"]`;
    
    const type = await element.getAttribute('type');
    const tagName = await element.evaluate((el: Element) => el.tagName.toLowerCase());
    
    if (tagName === 'input' && type) return `input[type="${type}"]`;
    if (tagName === 'button') return 'button[type="submit"]';
    
    // Fallback to a more general selector
    return tagName;
  } catch {
    return 'unknown';
  }
};

export const browserService = {
  async newContext(options?: { recordVideo?: boolean; recordHar?: boolean }): Promise<BrowserContext> {
    const browserInstance = await getBrowser();
    
    const contextOptions: any = {
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      locale: 'en-US',
    };
    
    // Enable video recording if requested
    if (options?.recordVideo) {
      contextOptions.recordVideo = {
        dir: '/tmp/jestbest-videos',
        size: { width: 1280, height: 800 },
      };
    }
    
    // Enable HAR recording if requested
    if (options?.recordHar) {
      contextOptions.recordHar = {
        path: `/tmp/jestbest-har-${Date.now()}.har`,
        omitContent: false,
      };
    }
    
    return browserInstance.newContext(contextOptions);
  },

  async closeContext(context: BrowserContext): Promise<void> {
    await context.close();
  },
  
  async saveVideo(page: Page): Promise<string | null> {
    try {
      const videoPath = await page.video()?.path();
      if (!videoPath) return null;
      
      // Video is saved locally, return the path
      // In production, upload to S3 using storageService
      return videoPath;
    } catch (error) {
      logger.error({ error }, 'Failed to save video');
      return null;
    }
  },
  
  async saveHar(_context: BrowserContext): Promise<string | null> {
    try {
      // HAR is automatically saved when context closes if recordHar was enabled
      // Return the path that was set during context creation
      return null; // Will be set by context options
    } catch (error) {
      logger.error({ error }, 'Failed to save HAR');
      return null;
    }
  },

  async navigate(context: BrowserContext, url: string): Promise<PageSnapshot> {
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(800);

      const title = (await page.title()).slice(0, 300) || null;
      const links = await page.$$eval('a[href]', (anchors) =>
        anchors.map((a) => (a as HTMLAnchorElement).href).filter(Boolean)
      );
      const components = await page.evaluate(() => {
        const buildCssSelector = (element: Element): string | null => {
          if (element.id) {
            return `#${CSS.escape(element.id)}`;
          }
          if (element.hasAttribute('data-testid')) {
            return `[data-testid="${CSS.escape(element.getAttribute('data-testid') ?? '')}"]`;
          }
          const path: string[] = [];
          let current: Element | null = element;
          while (current && current !== document.body && path.length < 8) {
            let segment = current.tagName.toLowerCase();
            if (current.id) {
              segment = `${segment}#${CSS.escape(current.id)}`;
            } else {
              const parent = current.parentElement;
              if (parent) {
                const siblings = Array.from(parent.children).filter(
                  (child) => child.tagName === (current as Element).tagName
                );
                if (siblings.length > 1) {
                  segment = `${segment}:nth-of-type(${siblings.indexOf(current) + 1})`;
                }
              }
            }
            path.unshift(segment);
            current = current.parentElement;
          }
          const selector = path.join(' > ');
          if (!selector) return null;
          return selector.slice(0, 200);
        };

        const results: Array<{ name: string | null; selector: string; type: string }> = [];
        const seen = new Set<string>();
        const visits = (element: Element) => {
          const tag = element.tagName.toLowerCase();
          let type: string = tag;
          if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') {
            type = tag;
          } else if (tag === 'a') {
            type = 'link';
          } else if (tag === 'form') {
            type = 'form';
          } else if (tag === 'table') {
            type = 'table';
          } else if (tag === 'img') {
            type = 'image';
          } else if (tag === 'nav') {
            type = 'navigation';
          } else if (element.hasAttribute('role')) {
            type = `role:${element.getAttribute('role')}`;
          }
          const interesting =
            ['input', 'textarea', 'select', 'button', 'a', 'form', 'table', 'nav'].includes(tag) ||
            element.hasAttribute('role');
          if (interesting) {
            const selector = buildCssSelector(element);
            if (selector && !seen.has(selector)) {
              seen.add(selector);
              const name =
                element.getAttribute('aria-label') ||
                element.getAttribute('name') ||
                element.textContent?.trim()?.slice(0, 80);
              results.push({ name: name || null, selector, type });
            }
          }
          for (const child of Array.from(element.children)) {
            if (results.length < 200) visits(child);
          }
        };
        visits(document.body);
        return results;
      });

      const text = (await page.evaluate(() => document.body?.innerText ?? '')).slice(0, 100000);

      return { url: page.url(), title, links: Array.from(new Set(links)).slice(0, 200), components, text };
    } catch (error) {
      logger.error({ url, err: error }, 'browser navigate failed');
      throw error;
    } finally {
      await page.close();
    }
  },

  async discoverWorkflows(context: BrowserContext, baseUrl: string): Promise<WorkflowSnapshot[]> {
    const workflows: WorkflowSnapshot[] = [];
    const page = await context.newPage();
    
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);
      
      // Detect login workflow
      const loginForm = await page.$(
        'form[action*="login"], form[action*="signin"], form:has(input[type="password"])'
      );
      
      if (loginForm) {
        const emailInput = await loginForm.$('input[type="email"], input[name*="email"], input[name*="username"]');
        const passwordInput = await loginForm.$('input[type="password"]');
        const submitButton = await loginForm.$('button[type="submit"], input[type="submit"]');
        
        if (emailInput && passwordInput && submitButton) {
          const emailSelector = await getSelectorFor(emailInput);
          const passwordSelector = await getSelectorFor(passwordInput);
          const submitSelector = await getSelectorFor(submitButton);
          
          workflows.push({
            name: 'User Login',
            steps: [
              { action: 'goto', url: page.url() },
              { action: 'fill', selector: emailSelector, value: '{{email}}' },
              { action: 'fill', selector: passwordSelector, value: '{{password}}' },
              { action: 'click', selector: submitSelector },
              { action: 'waitForNavigation' },
            ],
          });
        }
      }
      
      // Detect signup/registration workflow
      const signupForm = await page.$(
        'form[action*="signup"], form[action*="register"], a[href*="signup"], a[href*="register"]'
      );
      
      if (signupForm) {
        const isLink = (await signupForm.evaluate(el => el.tagName)) === 'A';
        
        if (isLink) {
          const href = await signupForm.getAttribute('href');
          if (href) {
            const signupUrl = new URL(href, baseUrl).href;
            await page.goto(signupUrl, { waitUntil: 'domcontentloaded' });
            
            const form = await page.$('form');
            if (form) {
              const nameInput = await form.$('input[name*="name"], input[id*="name"]');
              const emailInput = await form.$('input[type="email"], input[name*="email"]');
              const passwordInput = await form.$('input[type="password"]');
              const submitButton = await form.$('button[type="submit"], input[type="submit"]');
              
              if (emailInput && passwordInput) {
                workflows.push({
                  name: 'User Registration',
                  steps: [
                    { action: 'goto', url: signupUrl },
                    ...(nameInput ? [{ action: 'fill', selector: await getSelectorFor(nameInput), value: '{{name}}' }] : []),
                    { action: 'fill', selector: await getSelectorFor(emailInput), value: '{{email}}' },
                    { action: 'fill', selector: await getSelectorFor(passwordInput), value: '{{password}}' },
                    { action: 'click', selector: await getSelectorFor(submitButton) },
                    { action: 'waitForNavigation' },
                  ],
                });
              }
            }
          }
        }
      }
      
      // Detect search workflow
      const searchInput = await page.$(
        'input[type="search"], input[name*="search"], input[placeholder*="search" i]'
      );
      
      if (searchInput) {
        const searchForm = await searchInput.$('xpath=ancestor::form');
        const searchButton = searchForm 
          ? await searchForm.$('button[type="submit"], input[type="submit"]')
          : null;
        
        workflows.push({
          name: 'Search',
          steps: [
            { action: 'goto', url: page.url() },
            { action: 'fill', selector: await getSelectorFor(searchInput), value: '{{searchTerm}}' },
            ...(searchButton ? [{ action: 'click', selector: await getSelectorFor(searchButton) }] : []),
            { action: 'waitForNavigation' },
          ],
        });
      }
      
      // Detect contact form workflow
      const contactForm = await page.$('form[action*="contact"], form[id*="contact"]');
      
      if (contactForm) {
        const nameInput = await contactForm.$('input[name*="name"]');
        const emailInput = await contactForm.$('input[type="email"], input[name*="email"]');
        const messageInput = await contactForm.$('textarea');
        const submitButton = await contactForm.$('button[type="submit"], input[type="submit"]');
        
        if (emailInput && messageInput) {
          workflows.push({
            name: 'Contact Form Submission',
            steps: [
              { action: 'goto', url: page.url() },
              ...(nameInput ? [{ action: 'fill', selector: await getSelectorFor(nameInput), value: '{{name}}' }] : []),
              { action: 'fill', selector: await getSelectorFor(emailInput), value: '{{email}}' },
              { action: 'fill', selector: await getSelectorFor(messageInput), value: '{{message}}' },
              { action: 'click', selector: await getSelectorFor(submitButton) },
            ],
          });
        }
      }
      
      return workflows;
    } catch (error) {
      logger.error({ error, baseUrl }, 'workflow discovery failed');
      return workflows; // Return whatever we found
    } finally {
      await page.close();
    }
  },

  getSelectorFor,

  async close(): Promise<void> {
    if (browser) {
      await browser.close();
      browser = null;
    }
  },
};
