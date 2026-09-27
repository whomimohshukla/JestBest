import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, Zap, Bug, CheckCircle2, GitBranch, Database } from 'lucide-react';

interface AuthSplitLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaTo: string;
  ctaQuestion: string;
}

const nodes = [
  { icon: Zap, label: 'Agent scans your app', note: 'discovers flows & edge cases', top: '8%', left: '4%' },
  { icon: Bug, label: 'Bugs auto-detected', note: 'root cause, every failure', top: '30%', left: '62%' },
  { icon: GitBranch, label: 'Tests written for you', note: 'resilient suites, kept green', top: '58%', left: '6%' },
  { icon: Database, label: 'Results & analytics', note: 'live dashboards, CI-ready', top: '78%', left: '52%' },
];

export default function AuthSplitLayout({ children, title, subtitle, ctaLabel, ctaTo, ctaQuestion }: AuthSplitLayoutProps) {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex">
      {/* dotted grid backdrop */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-red-600/10 blur-3xl" />

      {/* LEFT panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-center px-12 relative z-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 shadow-lg shadow-red-600/30">
            <Bot className="h-6 w-6 text-white" />
          </div>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
          className="text-5xl font-light tracking-tight leading-[1.1]">
          Test your app <span className="text-red-500 italic font-serif">with AI</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}
          className="mt-6 text-lg text-neutral-400 font-light">
          Agents explore, generate, run and explain your QA — so your team ships faster.
        </motion.p>

        {/* ER / flow diagram — dotted box-inside-box */}
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35, duration: 0.6 }}
          className="relative mt-14 h-72">
          <div className="absolute inset-0 rounded-2xl border-2 border-white/15" />
          <div className="absolute inset-3 rounded-xl border border-dashed border-red-500/40" />
          <div className="absolute inset-8 rounded-lg border border-white/10 bg-white/[0.02]" />

          {nodes.map((n, i) => (
            <motion.div key={n.label}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.15, type: 'spring', stiffness: 200, damping: 18 }}
              whileHover={{ scale: 1.06 }}
              className="absolute flex items-start gap-2.5"
              style={{ top: n.top, left: n.left }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-500/40 bg-black">
                <n.icon className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{n.label}</p>
                <p className="text-xs text-neutral-400">{n.note}</p>
              </div>
            </motion.div>
          ))}

          {/* dashed connectors between nodes */}
          <svg className="absolute inset-0 h-full w-full pointer-events-none" fill="none">
            <line x1="22%" y1="20%" x2="63%" y2="38%" stroke="rgba(239,68,68,0.45)" strokeWidth="1.5" strokeDasharray="5 5" />
            <line x1="63%" y1="50%" x2="16%" y2="62%" stroke="rgba(239,68,68,0.35)" strokeWidth="1.5" strokeDasharray="5 5" />
            <line x1="16%" y1="72%" x2="52%" y2="82%" stroke="rgba(239,68,68,0.35)" strokeWidth="1.5" strokeDasharray="5 5" />
          </svg>
        </motion.div>
      </div>

      {/* RIGHT panel — the form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="w-full max-w-md">
          {/* mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600">
              <Bot className="h-5 w-5 text-white" />
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-light tracking-tight">{title}</h2>
            <p className="mt-2 text-neutral-400">{subtitle}</p>
          </div>

          {children}

          <p className="mt-6 text-center text-sm text-neutral-400">
            {ctaQuestion}{' '}
            <Link to={ctaTo} className="text-red-500 hover:underline font-medium">{ctaLabel}</Link>
          </p>
          <p className="mt-4 text-center text-xs text-neutral-500 flex items-center justify-center gap-1">
            Trusted by QA teams shipping faster <CheckCircle2 className="h-3 w-3 text-red-500" />
          </p>
        </motion.div>
      </div>
    </div>
  );
}
