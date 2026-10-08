import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../api';
import { useProjectStore } from '../store/projectStore';

/**
 * Shared project filter for the project-scoped screens (Test Cases, Test
 * Suites, Test Runs).
 *
 * Resolution order:
 *   1. an explicit `?projectId=` in the URL (deep links win),
 *   2. the last project the user selected (persisted across pages),
 *   3. the only project, when the workspace has exactly one.
 *
 * The resolved id is written back to both the store and the URL so it survives
 * navigation and refresh. Without this every page asked for the project again.
 */
export function useProjectFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useProjectStore((state) => state.setSelectedProjectId);

  const { data: projectList, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'select'],
    queryFn: () => projectsApi.list({ pageSize: 100 }),
  });

  const projects = useMemo(() => projectList?.items ?? [], [projectList]);

  const urlProjectId = searchParams.get('projectId') ?? '';
  const validStoredId = projects.some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : '';

  const effectiveProjectId =
    urlProjectId || validStoredId || (projects.length === 1 ? projects[0].id : '');

  // Remember whatever we resolved so the next screen starts from the same place.
  useEffect(() => {
    if (!effectiveProjectId || effectiveProjectId === selectedProjectId) return;
    setSelectedProjectId(effectiveProjectId);
  }, [effectiveProjectId, selectedProjectId, setSelectedProjectId]);

  // Reflect the resolved project in the URL so refresh and shared links keep it.
  useEffect(() => {
    if (!effectiveProjectId || urlProjectId === effectiveProjectId) return;
    const next = new URLSearchParams(searchParams);
    next.set('projectId', effectiveProjectId);
    setSearchParams(next, { replace: true });
  }, [effectiveProjectId, urlProjectId, searchParams, setSearchParams]);

  const selectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    const next = new URLSearchParams(searchParams);
    if (projectId) {
      next.set('projectId', projectId);
    } else {
      next.delete('projectId');
    }
    setSearchParams(next, { replace: true });
  };

  return { selectedProjectId: effectiveProjectId, selectProject, projects, projectsLoading };
}
