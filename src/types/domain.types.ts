import type { Prisma } from '@prisma/client';

export type JsonValue = Prisma.JsonValue;
export type JsonObject = Prisma.JsonObject;
export type InputJsonValue = Prisma.InputJsonValue;

export interface TestStep {
  action:
    | 'goto'
    | 'click'
    | 'fill'
    | 'press'
    | 'waitForSelector'
    | 'waitForTimeout'
    | 'expectVisible'
    | 'expectText'
    | 'expectAttribute'
    | 'expectStatus'
    | 'screenshot';
  selector?: string;
  value?: string;
  text?: string;
  attribute?: string;
  timeout?: number;
}

export type TestStepsPayload = TestStep[];

export interface AppPageNode {
  name: string;
  url: string;
  title?: string | null;
  components: AppComponentNode[];
}

export interface AppComponentNode {
  name: string;
  selector: string;
  type: string;
  pageId?: string | null;
}

export interface AppWorkflowNode {
  name: string;
  steps: JsonValue;
  pageId?: string | null;
}

export interface ScanSummary {
  pagesDiscovered: number;
  componentsDiscovered: number;
  workflowsDiscovered: number;
}
