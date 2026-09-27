import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { integrationsApi } from '../../api';
import { PageLoader, Badge } from '../../components/ui';
import { Plug, Settings2, ExternalLink, RefreshCw } from 'lucide-react';
import type { Integration } from '../../types';

type IntegrationListItem = Integration & {
  availability?: { configured: boolean; metadata?: Record<string, unknown> };
};

export default function IntegrationsSettingsPage() {
  const { data: integrationList, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => integrationsApi.list(),
  });

  const isConnected = (it: IntegrationListItem) =>
    Boolean(it.isActive ?? it.availability?.configured);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="glass p-6 rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-600/10 flex items-center justify-center">
            <Plug className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-1">Integrations</h2>
            <p className="text-sm text-muted-foreground">View connection status for your integrations</p>
          </div>
        </div>

        {isLoading && <PageLoader label="Loading integrations..." />}

        {!isLoading && isError && (
          <div className="rounded-xl border border-border bg-secondary/30 p-6 text-center">
            <p className="text-red-500 font-medium mb-4">Failed to load integrations.</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && (!integrationList || integrationList.length === 0) && (
          <p className="text-sm text-muted-foreground py-6 text-center">No integrations configured yet.</p>
        )}

        {!isLoading && !isError && integrationList && integrationList.length > 0 && (
          <div className="space-y-3">
            {integrationList.map((it, index) => (
              <motion.div
                key={it.id ?? it.type}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between gap-4 p-4 bg-secondary/30 border border-border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-600/10 flex items-center justify-center">
                    <Settings2 className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{it.type}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isConnected(it) ? (
                    <Badge variant="success">Connected</Badge>
                  ) : (
                    <Badge variant="secondary">Not configured</Badge>
                  )}
                  <Link
                    to="/integrations"
                    className="flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Manage
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-6">
          Full configuration lives in the Integrations page.
        </p>
      </div>
    </motion.div>
  );
}