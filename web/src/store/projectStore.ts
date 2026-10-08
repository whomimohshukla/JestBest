import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProjectSelectionState {
  /**
   * Last project the user picked in a project-scoped screen.
   *
   * Test Cases, Test Suites and Test Runs are all scoped to a project, but each
   * page held its own `useState` seeded only from `?projectId=`. Navigating
   * between them dropped the choice, so the user had to re-select the same
   * project on every page. Persisting it here makes the choice stick.
   */
  selectedProjectId: string;
  setSelectedProjectId: (projectId: string) => void;
  clearSelectedProject: () => void;
}

export const useProjectStore = create<ProjectSelectionState>()(
  persist(
    (set) => ({
      selectedProjectId: '',
      setSelectedProjectId: (projectId) => set({ selectedProjectId: projectId }),
      clearSelectedProject: () => set({ selectedProjectId: '' }),
    }),
    { name: 'project-selection' }
  )
);
