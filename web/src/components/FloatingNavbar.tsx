import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, Menu, X, ArrowRight } from 'lucide-react';

const navLinks = [
  { label: 'Features', href: '#features', id: 'features' },
  { label: 'How it works', href: '#how-it-works', id: 'how-it-works' },
  { label: 'AI Agents', href: '#agents', id: 'agents' },
  { label: 'Pricing', href: '#pricing', id: 'pricing' },
  { label: 'FAQ', href: '#faq', id: 'faq' },
];

export function FloatingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('Home');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 90);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="fixed inset-x-0 top-3 z-50 flex justify-center px-3 sm:px-6">
      <motion.div
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`w-full max-w-5xl rounded-full border px-4 py-2.5 backdrop-blur-2xl transition-all duration-300 ${
          scrolled
            ? 'border-red-500/50 bg-black/90 shadow-2xl shadow-teal-500/30'
            : 'border-white/10 bg-black/50'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 pl-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 shadow-lg shadow-teal-500/40">
              <Bot className="h-5 w-5 text-white" />
            </div>

          </Link>

          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <a
                key={link.id}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo(link.id);
                }}
                className={`relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active === link.id
                    ? 'text-white bg-white/10'
                    : 'text-zinc-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            <Link
              to="/auth/login"
              className="px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/auth/register"
              className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/30 hover:shadow-red-500/50 hover:-translate-y-0.5 transition-all"
            >
              Start for free
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden rounded-lg p-2 text-zinc-300 hover:bg-white/10 transition-colors"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden mt-2 flex flex-col gap-1 border-t border-white/10 pt-2">
            {navLinks.map((link) => (
              <a
                key={link.id}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo(link.id);
                  setMobileOpen(false);
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-1 flex gap-2">
              <Link
                to="/auth/login"
                className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-center text-sm font-medium hover:bg-white/10 transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/auth/register"
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-center text-sm font-semibold text-white"
              >
                Start for free
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </header>
  );
}
