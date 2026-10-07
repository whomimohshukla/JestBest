import { applicationRepository } from '../../repositories/application.repository';
import { browserService } from '../browser/browserService';
import { logger } from '../../config/logger';
import { toSlug } from '../../utils/helpers';
import { assertSafeUrl } from '../../utils/safeFetch';
import type { Prisma } from '@prisma/client';

export interface ExploreParams {
  applicationId: string;
  baseUrl: string;
  environmentId?: string;
  testUserId?: string;
  maxPages?: number;
}

export interface ExploreResult {
  pagesDiscovered: number;
  componentsDiscovered: number;
  workflowsDiscovered: number;
}

const MAX_PAGES = 25;
const MAX_COMPONENTS_PER_PAGE = 60;

export const scannerService = {
  async exploreApplication(params: ExploreParams): Promise<ExploreResult> {
    // Every link reached from here is user-supplied (and, once the crawl
    // starts, attacker-supplied), so the whole context — including redirects
    // the per-URL check above cannot see — refuses private addresses.
    const browserContext = await browserService.newContext({ blockPrivateNetwork: true });
    let pagesDiscovered = 0;
    let componentsDiscovered = 0;
    let workflowsDiscovered = 0;

    try {
      const seenUrls = new Set<string>();
      const queue: string[] = [params.baseUrl];
      const maxPages = params.maxPages ?? MAX_PAGES;

      while (queue.length > 0 && seenUrls.size < maxPages) {
        const url = queue.shift();
        if (!url || seenUrls.has(url)) continue;

        // Every navigation target is user-supplied and reached from the server's
        // network position, so each hop is re-checked: an external page can link
        // to an internal host and drag the browser there. `--no-sandbox` in
        // browserService makes the consequences of reaching an internal admin
        // service considerably worse.
        try {
          await assertSafeUrl(url);
        } catch (error) {
          logger.warn({ url, err: error }, 'skipped unsafe URL during exploration');
          continue;
        }

        seenUrls.add(url);

        let snapshot;
        try {
          snapshot = await browserService.navigate(browserContext, url);
        } catch (error) {
          logger.warn({ url, err: error }, 'failed to navigate during exploration');
          continue;
        }

        const pageName = toSlug(snapshot.title ?? url.replace(/^https?:\/\//, '')) || 'page';
        const page = await applicationRepository.addPage({
          applicationId: params.applicationId,
          name: pageName.slice(0, 120),
          url: snapshot.url,
          title: snapshot.title,
          order: pagesDiscovered,
          description: snapshot.title ?? undefined,
        });

        pagesDiscovered += 1;

        for (const component of snapshot.components.slice(0, MAX_COMPONENTS_PER_PAGE)) {
          await applicationRepository.addComponent({
            applicationId: params.applicationId,
            pageId: page.id,
            name: component.name ?? toSlug(`${component.type}-${component.selector}`),
            selector: component.selector,
            type: component.type,
          });
          componentsDiscovered += 1;
        }

        for (const link of snapshot.links) {
          const absolute = new URL(link, params.baseUrl).href;
          if (absolute.startsWith(params.baseUrl) && !seenUrls.has(absolute)) {
            queue.push(absolute);
          }
        }
      }

      const workflows = await browserService.discoverWorkflows(browserContext, params.baseUrl);
      for (const workflow of workflows) {
        await applicationRepository.addWorkflow({
          applicationId: params.applicationId,
          name: workflow.name,
          steps: workflow.steps as unknown as Prisma.InputJsonValue,
          order: workflows.indexOf(workflow),
        });
        workflowsDiscovered += 1;
      }

      return { pagesDiscovered, componentsDiscovered, workflowsDiscovered };
    } finally {
      await browserService.closeContext(browserContext);
    }
  },
};
