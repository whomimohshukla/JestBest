-- Composite list indexes
--
-- Every paginated list endpoint filters on a scope column and then sorts by
-- `createdAt DESC`:
--
--   /test-runs   WHERE projectId      (or project.organizationId) [AND status] ORDER BY createdAt DESC
--   /bugs        WHERE organizationId | projectId  [AND status] [AND severity] ORDER BY createdAt DESC
--   /audit-logs  WHERE organizationId [AND resourceType]         ORDER BY createdAt DESC
--   /webhooks/:id/deliveries  WHERE webhookId                    ORDER BY createdAt DESC
--   /test-cases  WHERE projectId      [AND type]                 ORDER BY createdAt DESC
--
-- With a single-column index Postgres finds the rows, then sorts them, which
-- degrades to a top-N sort once the org owns tens of thousands of rows. The
-- composite (scope, createdAt) matches the ORDER BY exactly, so the planner
-- walks the index backwards and stops at `pageSize`.
--
-- Each index dropped below is a strict leading-column prefix of the index that
-- replaces it, so the equality-only queries that used the old index keep
-- working on the new one — no query loses index coverage.

-- CreateIndex
CREATE INDEX "TestCase_projectId_createdAt_idx" ON "TestCase"("projectId", "createdAt");
CREATE INDEX "TestRun_projectId_createdAt_idx" ON "TestRun"("projectId", "createdAt");
CREATE INDEX "TestRun_status_createdAt_idx" ON "TestRun"("status", "createdAt");
CREATE INDEX "Bug_organizationId_createdAt_idx" ON "Bug"("organizationId", "createdAt");
CREATE INDEX "Bug_projectId_createdAt_idx" ON "Bug"("projectId", "createdAt");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX "WebhookDelivery_webhookId_createdAt_idx" ON "WebhookDelivery"("webhookId", "createdAt");

-- DropIndex
DROP INDEX "TestCase_projectId_idx";
DROP INDEX "TestRun_projectId_idx";
DROP INDEX "TestRun_status_idx";
DROP INDEX "Bug_organizationId_idx";
DROP INDEX "Bug_projectId_idx";
DROP INDEX "AuditLog_organizationId_idx";
DROP INDEX "WebhookDelivery_webhookId_idx";
