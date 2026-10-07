import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bugsApi, organizationApi, type BugComment } from '../../api';
import { getErrorMessage } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import Layout from '../../components/Layout';
import {
  PageLoader,
  EmptyState,
  Select,
  BugStatusBadge,
  SeverityBadge,
  PriorityBadge,
  InfoRow,
  Button,
} from '../../components/ui';
import {
  ArrowLeft,
  Trash2,
  MessageSquare,
  User,
  Bug,
  Loader2,
  Calendar,
  RefreshCw,
  GitBranch,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { BugStatus } from '../../types';
import { BUG_STATUSES } from '../../lib/bugStatus';

const getRelativeTime = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

export default function BugDetailPage() {
  const { bugId } = useParams<{ bugId: string }>();
  const navigate = useNavigate();
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['bug', bugId],
    queryFn: () => bugsApi.get(bugId as string),
    enabled: !!bugId,
  });

  const { data: commentsData } = useQuery({
    queryKey: ['bug-comments', bugId],
    queryFn: () => bugsApi.comments(bugId as string),
    enabled: !!bugId,
  });

  const { data: membersData } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: () => organizationApi.members(orgId as string),
    enabled: Boolean(orgId),
  });

  const comments = commentsData?.items ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bugsApi.remove(id),
    onSuccess: () => {
      toast.success('Bug deleted');
      navigate('/bugs');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: (status: BugStatus) => bugsApi.changeStatus(bugId as string, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bug', bugId] });
      queryClient.invalidateQueries({ queryKey: ['bugs'] });
      toast.success('Bug status updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const assignMutation = useMutation({
    mutationFn: (assigneeId: string | null) => bugsApi.assign(bugId as string, assigneeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bug', bugId] });
      queryClient.invalidateQueries({ queryKey: ['bugs'] });
      toast.success('Assignee updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => bugsApi.addComment(bugId as string, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bug-comments', bugId] });
      queryClient.invalidateQueries({ queryKey: ['bug', bugId] });
      setComment('');
      toast.success('Comment added');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    addCommentMutation.mutate(comment.trim());
  };

  const handleDelete = () => {
    if (window.confirm(`Delete bug "${bug?.title}"?`)) {
      deleteMutation.mutate(bugId as string);
    }
  };

  const raiseGithubMutation = useMutation({
    mutationFn: () => bugsApi.raiseOnGithub(bugId as string),
    onSuccess: (updated) => {
      queryClient.setQueryData(['bug', bugId], updated);
      queryClient.invalidateQueries({ queryKey: ['bug', bugId] });
      queryClient.invalidateQueries({ queryKey: ['bugs'] });
      toast.success('Bug reported to GitHub');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <PageLoader label="Loading bug..." />
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout>
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-red-500 font-medium mb-4">Failed to load bug details.</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Retry
          </button>
        </div>
      </Layout>
    );
  }

  const bug = data;

  if (!bug) {
    return (
      <Layout>
        <EmptyState icon={Bug} title="Bug not found" description="This bug may have been deleted." />
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <Link
              to="/bugs"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Bugs
            </Link>
            <div className="flex items-center gap-3 mb-2">
              <BugStatusBadge status={bug.status} />
              <h1 className="text-4xl font-bold gradient-text">{bug.title}</h1>
            </div>
          </div>
          {bug.githubIssueUrl ? (
            <a
              href={bug.githubIssueUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors bg-foreground/5 hover:bg-foreground/10 text-foreground border border-white/10"
            >
              <GitBranch className="w-4 h-4" />
              GitHub Issue
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button
              onClick={() => raiseGithubMutation.mutate()}
              disabled={raiseGithubMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors bg-foreground/5 hover:bg-foreground/10 text-foreground border border-white/10 disabled:opacity-50"
              title="Report this bug as a GitHub issue in your connected repository"
            >
              {raiseGithubMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <GitBranch className="w-4 h-4" />
              )}
              Report on GitHub
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-destructive hover:bg-destructive/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Delete
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-3">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {bug.description || 'No description provided.'}
              </p>
            </div>

            {/* Status */}
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4">Status</h3>
              <div className="flex flex-wrap gap-2">
                {BUG_STATUSES.map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={bug.status === status ? 'default' : 'outline'}
                    disabled={changeStatusMutation.isPending}
                    onClick={() => changeStatusMutation.mutate(status)}
                  >
                    {status.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div className="glass p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-semibold">Comments</h3>
              </div>

              {comments.length === 0 && (
                <EmptyState
                  icon={MessageSquare}
                  title="No comments yet"
                  description="Be the first to comment on this bug."
                />
              )}

              <div className="space-y-4 mb-6">
                {comments.map((item: BugComment) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-red-600/10 flex items-center justify-center text-sm font-semibold text-red-500 shrink-0">
                      {item.user?.name?.[0]?.toUpperCase() ||
                        item.user?.email?.[0]?.toUpperCase() ||
                        'U'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {item.user?.name || item.user?.email || 'Unknown user'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getRelativeTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddComment} className="space-y-3">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  placeholder="Add a comment..."
                  rows={3}
                  disabled={addCommentMutation.isPending}
                />
                <Button
                  type="submit"
                  disabled={addCommentMutation.isPending || !comment.trim()}
                >
                  {addCommentMutation.isPending && <Loader2 className="animate-spin" />}
                  Add Comment
                </Button>
              </form>
            </div>
          </div>

          {/* Info panel */}
          <div className="glass p-6 rounded-xl h-fit">
            <h3 className="text-lg font-semibold mb-4">Details</h3>
            <div className="divide-y divide-border">
              <InfoRow
                icon={Bug}
                label="Severity"
                value={<SeverityBadge severity={bug.severity} />}
              />
              <InfoRow
                label="Priority"
                value={<PriorityBadge priority={bug.priority} />}
              />
              <InfoRow label="Project id" value={<span className="font-mono">{bug.projectId.slice(0, 8)}</span>} />
              <InfoRow
                icon={User}
                label="Assignee"
                value={
                  <Select
                    value={bug.assignee?.id ?? ''}
                    onChange={(e) => assignMutation.mutate(e.target.value === '' ? null : e.target.value)}
                    disabled={assignMutation.isPending}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    <option value="">Unassigned</option>
                    {(membersData ?? []).map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.user?.name || member.user?.email || member.userId.slice(0, 8)}
                      </option>
                    ))}
                  </Select>
                }
              />
              <InfoRow
                icon={Calendar}
                label="Created"
                value={new Date(bug.createdAt).toLocaleString()}
              />
              <InfoRow
                icon={Calendar}
                label="Updated"
                value={new Date(bug.updatedAt).toLocaleString()}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}