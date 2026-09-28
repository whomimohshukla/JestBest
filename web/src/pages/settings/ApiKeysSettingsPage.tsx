import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiKeysApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import { PageLoader, FieldError } from '../../components/ui';
import { Copy, KeyRound, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ApiKey } from '../../types';

export default function ApiKeysSettingsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyNameError, setKeyNameError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<ApiKey & { plainKey: string } | null>(null);

  const { data: apiKeys, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiKeysApi.list(),
  });

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => apiKeysApi.create({ name }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setCreatedKey(result);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key revoked');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      setKeyNameError('Enter a name for the key.');
      return;
    }
    setKeyNameError(null);
    createKeyMutation.mutate(keyName.trim());
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.plainKey);
      toast.success('Key copied to clipboard');
    } catch {
      toast.error('Failed to copy key');
    }
  };

  const handleRevoke = (key: ApiKey) => {
    if (window.confirm(`Revoke API key "${key.name}"? This cannot be undone.`)) {
      revokeMutation.mutate(key.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold mb-1">API Keys</h2>
          <p className="text-sm text-muted-foreground">Programmatic access to the JestBest API</p>
        </div>
        <button
          onClick={() => {
            setKeyName('');
            setCreatedKey(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-600/90 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Create Key
        </button>
      </div>

      {isLoading && <PageLoader label="Loading API keys..." />}

      {!isLoading && isError && (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-red-500 font-medium mb-4">Failed to load API keys.</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && (!apiKeys || apiKeys.length === 0) && (
        <div className="glass p-12 rounded-xl text-center">
          <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No API keys yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Create an API key to authenticate programmatic requests.
          </p>
          <button
            onClick={() => {
              setKeyName('');
              setCreatedKey(null);
              setShowModal(true);
            }}
            className="px-6 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors font-medium inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Key
          </button>
        </div>
      )}

      {!isLoading && !isError && apiKeys && apiKeys.length > 0 && (
        <div className="glass p-6 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-3 pr-4 font-medium">Name</th>
                <th className="py-3 pr-4 font-medium">Key</th>
                <th className="py-3 pr-4 font-medium">Last Used</th>
                <th className="py-3 pr-4 font-medium">Created</th>
                <th className="py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id} className="border-b border-border/50">
                  <td className="py-3 pr-4 font-medium">{key.name}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{key.prefix || `${key.key.slice(0, 8)}…`}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => handleRevoke(key)}
                      disabled={revokeMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium text-red-500 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md glass p-8 rounded-2xl"
          >
            {createdKey ? (
              <div>
                <h2 className="text-2xl font-bold mb-2">API Key Created</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Copy your new API key now.
                </p>

                <div className="flex items-center gap-2 bg-secondary/50 p-3 rounded-lg">
                  <code className="flex-1 font-mono text-sm break-all">{createdKey.plainKey}</code>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                </div>

                <p className="text-sm text-red-400 mt-4">
                  Store this key securely — it won't be shown again.
                </p>

                <div className="flex gap-3 pt-6">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold mb-2">Create API Key</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Give your key a descriptive name.
                </p>

                <form onSubmit={handleCreateKey} className="space-y-4">
                  <div>
                    <label htmlFor="key-name" className="block text-sm font-medium mb-2">
                      Key Name
                    </label>
                    <input
                      id="key-name"
                      type="text"
                      value={keyName}
                      onChange={(e) => {
                        setKeyName(e.target.value);
                        if (keyNameError) setKeyNameError(null);
                      }}
                      className={`w-full px-4 py-3 bg-secondary/50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${keyNameError ? 'border-red-500/70 ring-1 ring-red-500/40' : 'border-border'}`}
                      placeholder="e.g. CI pipeline"
                      disabled={createKeyMutation.isPending}
                      aria-invalid={!!keyNameError}
                      aria-describedby={keyNameError ? 'key-name-error' : undefined}
                      required
                    />
                    <FieldError id="key-name-error">{keyNameError}</FieldError>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                      disabled={createKeyMutation.isPending}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createKeyMutation.isPending}
                      className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {createKeyMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Key'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}