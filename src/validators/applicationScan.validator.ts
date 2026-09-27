import { z } from 'zod';

export const applicationScanParamsSchema = z.object({
  applicationId: z.string().min(1),
  scanId: z.string().min(1),
});
