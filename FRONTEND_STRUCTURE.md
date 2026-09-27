# JestBest Frontend Structure

## 📁 Folder Structure

```
web/
├── public/
│   ├── logo.svg
│   └── favicon.ico
├── src/
│   ├── api/                    # API client & endpoints
│   │   ├── client.ts          # Axios instance with interceptors
│   │   ├── auth.api.ts        # Authentication endpoints
│   │   ├── projects.api.ts    # Projects endpoints
│   │   ├── tests.api.ts       # Tests endpoints
│   │   ├── bugs.api.ts        # Bugs endpoints
│   │   ├── analytics.api.ts   # Analytics endpoints
│   │   └── index.ts
│   │
│   ├── components/             # Reusable components
│   │   ├── ui/                # Base UI components (shadcn-style)
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Tabs.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/            # Layout components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── DashboardLayout.tsx
│   │   │
│   │   ├── auth/              # Auth-specific components
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   │
│   │   ├── projects/          # Project components
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ProjectList.tsx
│   │   │   ├── CreateProjectModal.tsx
│   │   │   └── ProjectStats.tsx
│   │   │
│   │   ├── tests/             # Test components
│   │   │   ├── TestCaseCard.tsx
│   │   │   ├── TestRunTable.tsx
│   │   │   ├── TestResultViewer.tsx
│   │   │   └── TestStepEditor.tsx
│   │   │
│   │   ├── bugs/              # Bug components
│   │   │   ├── BugCard.tsx
│   │   │   ├── BugList.tsx
│   │   │   ├── BugDetails.tsx
│   │   │   └── CreateBugModal.tsx
│   │   │
│   │   ├── analytics/         # Analytics components
│   │   │   ├── TestTrendChart.tsx
│   │   │   ├── PassFailChart.tsx
│   │   │   ├── StatsCard.tsx
│   │   │   └── ActivityFeed.tsx
│   │   │
│   │   └── shared/            # Shared components
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       ├── EmptyState.tsx
│   │       └── SearchBar.tsx
│   │
│   ├── pages/                 # Page components
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── ForgotPasswordPage.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── DashboardPage.tsx
│   │   │   └── AnalyticsPage.tsx
│   │   │
│   │   ├── projects/
│   │   │   ├── ProjectsPage.tsx
│   │   │   └── ProjectDetailPage.tsx
│   │   │
│   │   ├── tests/
│   │   │   ├── TestsPage.tsx
│   │   │   ├── TestDetailPage.tsx
│   │   │   └── TestRunsPage.tsx
│   │   │
│   │   ├── bugs/
│   │   │   ├── BugsPage.tsx
│   │   │   └── BugDetailPage.tsx
│   │   │
│   │   ├── settings/
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   └── IntegrationsPage.tsx
│   │   │
│   │   └── NotFoundPage.tsx
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useProjects.ts
│   │   ├── useTests.ts
│   │   ├── useBugs.ts
│   │   ├── useAnalytics.ts
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   └── useWebSocket.ts
│   │
│   ├── store/                 # Zustand state management
│   │   ├── authStore.ts
│   │   ├── projectStore.ts
│   │   ├── uiStore.ts
│   │   └── index.ts
│   │
│   ├── types/                 # TypeScript types
│   │   ├── auth.types.ts
│   │   ├── project.types.ts
│   │   ├── test.types.ts
│   │   ├── bug.types.ts
│   │   ├── analytics.types.ts
│   │   └── index.ts
│   │
│   ├── utils/                 # Utility functions
│   │   ├── formatters.ts      # Date, number formatters
│   │   ├── validators.ts      # Validation helpers
│   │   ├── constants.ts       # App constants
│   │   ├── colors.ts          # Color utilities
│   │   └── helpers.ts         # General helpers
│   │
│   ├── routes/                # Route configuration
│   │   ├── index.tsx
│   │   └── ProtectedRoutes.tsx
│   │
│   ├── App.tsx                # Main App component
│   ├── main.tsx               # Entry point
│   └── vite-env.d.ts
│
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 🎨 Design System

### Colors
- **Primary:** Purple gradient (`#667eea` to `#764ba2`)
- **Background:** `#121212` (Very dark gray)
- **Cards:** `#1a1a1a` (Dark gray)
- **Text:** `#fafafa` (Off-white)
- **Accent:** `#8b5cf6` (Purple)
- **Success:** `#10b981` (Green)
- **Error:** `#ef4444` (Red)
- **Warning:** `#f59e0b` (Orange)

### Typography
- **Headings:** Inter, system-ui
- **Body:** Inter, system-ui
- **Code:** Fira Code, monospace

### Components
All components follow shadcn/ui patterns with dark theme.

## 🔄 Data Flow

```
User Action → Component
    ↓
React Hook (useAuth, useProjects, etc.)
    ↓
React Query (caching, invalidation)
    ↓
API Client (axios with interceptors)
    ↓
Backend API
    ↓
Response → React Query Cache
    ↓
Component Re-render
```

## 🗂️ State Management

### Zustand Stores
1. **authStore**: User authentication state
2. **projectStore**: Current project context
3. **uiStore**: UI state (sidebar, modals, toasts)

### React Query
- Server state (projects, tests, bugs, analytics)
- Automatic caching and refetching
- Optimistic updates

## 📡 API Integration

### Base URL
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'
```

### Authentication
- JWT tokens stored in localStorage
- Automatic token refresh
- Axios interceptors for auth headers

## 🎯 Key Features

### 1. Dashboard
- Overview stats (tests run, pass rate, bugs found)
- Recent activity feed
- Quick actions
- Test trend charts

### 2. Projects
- Project list with cards
- Create/edit/delete projects
- Project switching
- Team management

### 3. Tests
- Test case list with filters
- Test run history
- Real-time test execution status
- Test results with screenshots/videos
- AI-generated test suggestions

### 4. Bugs
- Bug list with severity/priority filters
- Bug detail with evidence
- Comments and activity timeline
- GitHub/Jira integration links

### 5. Analytics
- Test trends over time
- Pass/fail rate charts
- Flaky test detection
- Release risk scoring
- Top failing tests

### 6. Settings
- User profile
- Organization settings
- Team members
- Integrations (GitHub, Jira, Slack)
- API keys

## 🎨 Component Examples

### Button Variants
- Primary, Secondary, Destructive, Ghost, Link
- Sizes: sm, md, lg
- Loading state
- Icon support

### Cards
- Glass morphism effect
- Hover animations
- Gradient borders
- Status indicators

### Charts
- Line charts (trends)
- Bar charts (comparisons)
- Pie/Donut charts (distribution)
- Area charts (metrics)

## 🚀 Performance

- Code splitting by route
- Lazy loading components
- Image optimization
- React Query caching
- Debounced search
- Virtual scrolling for large lists

## 📱 Responsive Design

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Collapsible sidebar on mobile
- Touch-friendly buttons

## ♿ Accessibility

- ARIA labels
- Keyboard navigation
- Focus indicators
- Screen reader support
- Color contrast AA compliance

## 🔐 Security

- XSS protection
- CSRF tokens
- Secure token storage
- Input sanitization
- Content Security Policy

---

*This structure provides a scalable, maintainable, and modern React application.*
