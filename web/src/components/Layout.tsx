import { type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderKanban,
  PlaySquare,
  FlaskConical,
  Layers,
  Bug,
  BarChart3,
  BotMessageSquare,
  Plug,
  Settings,
  LogOut,
  User,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { Logo } from './Logo';
import { useState } from 'react';
import { cn } from '../utils/cn';
import { OfflineBanner } from './ui/OfflineBanner';
import { authApi } from '../api';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, section: 'Overview' },
  { name: 'Projects', href: '/projects', icon: FolderKanban, section: 'Workspace' },
  { name: 'Apps', href: '/applications', icon: Layers, section: 'Workspace' },
  { name: 'Test Cases', href: '/tests', icon: FlaskConical, section: 'Testing' },
  { name: 'Test Suites', href: '/test-suites', icon: Layers, section: 'Testing' },
  { name: 'Test Runs', href: '/runs', icon: PlaySquare, section: 'Testing' },
  { name: 'Bugs', href: '/bugs', icon: Bug, section: 'Quality' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, section: 'Quality' },
  { name: 'AI Agents', href: '/agents', icon: BotMessageSquare, section: 'Automation' },
  { name: 'Integrations', href: '/integrations', icon: Plug, section: 'Settings' },
  { name: 'Settings', href: '/settings', icon: Settings, section: 'Settings' },
];

const sections = [...new Set(navigation.map((n) => n.section))];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const organization = useAuthStore((state) => state.organization);
  const logout = useAuthStore((state) => state.logout);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const handleLogoutConfirm = async () => {
    try {
      await authApi.logout();
    } catch {
      // local logout should still proceed even if the session API fails
    }
    logout();
    setConfirmLogoutOpen(false);
    navigate('/');
  };

  const initial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'V';

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-secondary rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link to="/dashboard" className="flex items-center">
              <Logo variant="mark" size={30} />
            </Link>
            {organization && (
              <div className="hidden md:flex items-center gap-2 ml-2 pl-4 border-l border-border">
                <span className="text-sm text-muted-foreground">{organization.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/projects')}
              className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm bg-red-600/10 text-red-500 rounded-lg hover:bg-red-600/20 font-medium transition-colors"
            >
              <PlaySquare className="w-4 h-4" />
              New Run
            </button>

            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-full p-1 hover:ring-2 hover:ring-red-500/50 transition-all"
                aria-label="Profile menu"
              >
                <div className="w-9 h-9 rounded-full  from-red-600 to-red-700 flex items-center justify-center text-sm font-semibold text-white">
                  {initial}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground hidden sm:block rotate-90" />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-2xl p-1 z-50"
                  >
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="text-sm font-semibold truncate">{user?.name || 'User'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <Link
                      to="/settings/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-secondary"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-secondary"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        setConfirmLogoutOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-destructive/10 hover:text-destructive"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-border bg-card"
            >
              <nav className="px-4 py-4 space-y-4">
                {sections.map((section) => (
                  <div key={section}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-2">{section}</p>
                    {navigation
                      .filter((n) => n.section === section)
                      .map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors mb-1 ${
                              isActive(item.href)
                                ? 'bg-red-600 text-destructive-foreground'
                                : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="font-medium">{item.name}</span>
                          </Link>
                        );
                      })}
                  </div>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <OfflineBanner />

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card/50 sticky top-16 h-[calc(100vh-64px)]">
          <nav className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-thin">
            {sections.map((section) => (
              <div key={section}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-2">
                  {section}
                </p>
                {navigation
                  .filter((n) => n.section === section)
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all mb-1 text-sm',
                          isActive(item.href)
                            ? 'bg-red-600/15 text-red-500 font-medium ring-1 ring-red-500/30'
                            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
              </div>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-border">
            <div className="glass p-4 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Need help?</p>
              <a href="#" className="text-sm text-red-500 hover:underline font-medium">
                View Documentation →
              </a>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-64px)]">
          <div className="container mx-auto px-4 lg:px-6 py-8">{children}</div>
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {confirmLogoutOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmLogoutOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Log out?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You will need to sign in again to access your workspace.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setConfirmLogoutOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogoutConfirm}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive hover:bg-destructive/90 text-white transition-colors"
                >
                  Log out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}