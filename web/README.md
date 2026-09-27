# JestBest Frontend

Modern, responsive React web application for JestBest AI-Powered QA Automation Platform.

## 🎨 Tech Stack

- **React 18.3+** - UI library
- **TypeScript 6.0** - Type safety
- **Vite 8.3** - Build tool & dev server
- **Tailwind CSS 4.3** - Utility-first CSS framework
- **React Router 7.18** - Client-side routing
- **React Query** - Server state management
- **Zustand** - Client state management
- **Framer Motion** - Animations
- **Recharts** - Data visualization
- **React Hook Form + Zod** - Form handling & validation
- **Axios** - HTTP client
- **Lucide React** - Icon library

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Backend API running on `http://localhost:4000`

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
web/
├── src/
│   ├── api/              # API client configuration
│   │   └── client.ts     # Axios instance with interceptors
│   ├── components/       # Reusable UI components
│   │   └── Layout.tsx    # Main layout with navbar & sidebar
│   ├── pages/            # Page components
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── projects/
│   │   │   └── ProjectsPage.tsx
│   │   ├── tests/
│   │   │   └── TestsPage.tsx
│   │   └── bugs/
│   │       └── BugsPage.tsx
│   ├── store/            # State management
│   │   └── authStore.ts  # Zustand auth store
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts      # Shared types
│   ├── utils/            # Utility functions
│   │   └── cn.ts         # Class name merger
│   ├── App.tsx           # Root component with routing
│   ├── index.css         # Global styles & animations
│   └── main.tsx          # Entry point
├── public/               # Static assets
├── .env                  # Environment variables
├── index.html            # HTML template
├── package.json          # Dependencies & scripts
├── tailwind.config.js    # Tailwind configuration
├── tsconfig.json         # TypeScript configuration
└── vite.config.ts        # Vite configuration
```

## 🎨 Features

### Authentication
- ✅ User registration with organization creation
- ✅ Email/password login
- ✅ JWT token-based authentication
- ✅ Persistent sessions with localStorage
- ✅ Protected routes
- ✅ Auto-redirect on token expiry

### Dashboard
- ✅ Real-time analytics overview
- ✅ Test trend charts (Line chart)
- ✅ Bug severity distribution (Bar chart)
- ✅ Recent test runs list
- ✅ Critical alerts panel
- ✅ Time range filters (7d, 30d, 90d)

### Projects
- ✅ List all projects
- ✅ Create new projects
- ✅ Search & filter projects
- ✅ Project cards with metadata
- ✅ Archive projects
- ✅ Project statistics

### Tests
- ✅ View all test runs
- ✅ Filter by status (PASSED, FAILED, RUNNING)
- ✅ Real-time test run status
- ✅ Test results breakdown
- ✅ Progress indicators
- ✅ Download test reports
- ✅ View detailed test results

### Bugs
- ✅ List all bugs
- ✅ Filter by severity (CRITICAL, HIGH, MEDIUM, LOW)
- ✅ Filter by status (OPEN, IN_PROGRESS, FIXED, VERIFIED, CLOSED)
- ✅ Priority badges (P0, P1, P2, P3)
- ✅ Bug severity indicators
- ✅ Create new bug reports
- ✅ View bug details

### UI/UX
- ✅ Dark theme with purple accent (#667eea)
- ✅ Glass morphism effects
- ✅ Smooth animations (Framer Motion)
- ✅ Loading spinners
- ✅ Empty states
- ✅ Toast notifications
- ✅ Responsive design (mobile-first)
- ✅ Sticky header
- ✅ Sidebar navigation
- ✅ Footer with links

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the `web/` directory:

```env
VITE_API_URL=http://localhost:4000/api/v1
```

### API Endpoints

The frontend connects to these backend endpoints:

- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /analytics/dashboard` - Dashboard stats
- `GET /projects` - List projects
- `POST /projects` - Create project
- `GET /test-runs` - List test runs
- `GET /bugs` - List bugs
- `POST /bugs` - Create bug

## 🎨 Theme Customization

The theme is configured in `tailwind.config.js`:

```js
colors: {
  primary: '#667eea',      // Purple accent
  background: '#0a0a0a',   // Black background
  foreground: '#fafafa',   // White text
  // ... more colors
}
```

## 🔐 Authentication Flow

1. User submits login/register form
2. API returns JWT token + user data
3. Token stored in localStorage
4. Axios interceptor adds token to all requests
5. On 401 response, user redirected to login
6. Zustand store manages auth state

## 🚀 Deployment

### Deploy to Vercel

```bash
npm run build
vercel --prod
```

### Deploy to Netlify

```bash
npm run build
netlify deploy --prod --dir=dist
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview"]
```

## 📱 Responsive Breakpoints

- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## 🎯 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 🐛 Known Issues

- None currently

## 🔜 Roadmap

- [ ] Real-time WebSocket updates
- [ ] Advanced filtering & sorting
- [ ] Bulk operations
- [ ] Export to CSV/PDF
- [ ] Team collaboration features
- [ ] User preferences & settings
- [ ] Notification center
- [ ] Dark/Light theme toggle
- [ ] Internationalization (i18n)

## 📝 License

MIT

## 👥 Contributors

JestBest Team

---

**Built with ❤️ using React + TypeScript + Tailwind CSS**
