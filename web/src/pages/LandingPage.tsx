import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bot, Brain, Bug, LineChart, GitBranch, Terminal,
  CheckCircle2, Play,
  Flame, Check, Plus, ArrowRight,
} from 'lucide-react';
import { FloatingNavbar } from '../components/FloatingNavbar';
import { RunConsole } from '../components/RunConsole';
import { Logo } from '../components/Logo';

const features = [
  { icon: Brain, title: 'AI Test Generation', description: 'JestBest explores your app, maps flows, and writes resilient test suites automatically.', bullets: ['Natural-language authoring', 'Self-healing selectors', 'Edge-case discovery'] },
  { icon: Bug, title: 'Automatic Bug Detection', description: 'Every failure is analyzed and enriched with screenshots, video, and AI root-cause analysis.', bullets: ['Video + screenshot evidence', 'Severity auto-triage', 'One-click issue creation'] },
  { icon: LineChart, title: 'Live Quality Analytics', description: 'Track pass rates and flaky tests on a live dashboard. Know when you are safe to ship.', bullets: ['Flaky test detection', 'Release risk scoring', 'Weekly digests'] },
  { icon: GitBranch, title: 'Seamless CI/CD', description: 'Trigger runs from any pipeline. Isolated environments report results back instantly.', bullets: ['GitHub Actions-ready', 'Webhook-driven runs', 'Parallel execution'] },
];

const steps = [
  { step: '01', title: 'Connect your app', description: 'Add your URL or repo. JestBest discovers pages and flows instantly.' },
  { step: '02', title: 'AI writes tests', description: 'Explore, map, and author a full QA suite with zero scripting.' },
  { step: '03', title: 'Run and ship', description: 'Parallel runs with rich evidence, then AI triage before you ship.' },
];

const agents = [
  { icon: Bot, name: 'Test Explorer', description: 'Maps your app and finds untested flows.', tag: 'Discovery' },
  { icon: Flame, name: 'Bug Hunter', description: 'Runs adversarial scenarios to shake out bugs first.', tag: 'Proactive QA' },
  { icon: LineChart, name: 'Regression Analyst', description: 'Detects flaky tests and isolates root causes.', tag: 'Reliability' },
  { icon: Terminal, name: 'Performance Auditor', description: 'Benchmarks load times and finds regressions.', tag: 'Performance' },
];

const plans = [
  { name: 'Free', monthly: 0, description: 'For solo developers trying AI QA.', features: ['1 project', '5 test runs / month', 'Community support'], cta: 'Start free', highlight: false },
  { name: 'Pro', monthly: 29, description: 'For teams shipping every week.', features: ['10 projects', '500 test runs / month', 'Email support', 'CI/CD integrations'], cta: 'Start 14-day trial', highlight: true },
  { name: 'Enterprise', monthly: null, description: 'For orgs with strict SLAs.', features: ['Unlimited runs', 'SSO & audit logs', 'Dedicated infra', 'Custom AI agents'], cta: 'Contact sales', highlight: false },
];

const faqs = [
  { q: 'How does JestBest generate tests?', a: 'Our agents crawl your deployed app, map every page and interaction, then write resilient tests that self-heal when selectors change.' },
  { q: 'Does the AI actually find bugs?', a: 'Yes. Agents adversarially explore edge cases, watch console and network, and flag probable bugs with screenshots and root-cause.' },
  { q: 'Can it run in CI/CD?', a: 'JestBest ships Playwright runners with CLI + GitHub Actions support, so suites run on every push.' },
  { q: 'How is this different from plain Playwright?', a: 'You describe the outcome; agents handle exploration, authoring, maintenance, and analysis for you.' },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-black text-white antialiased selection:bg-red-500/30">
      {/* zero-gradient, logo-only nav */}
      <FloatingNavbar />

      {/* ===== HERO / SPLIT ===== */}
      <section className="relative overflow-hidden pt-32 pb-24 lg:pt-40 lg:pb-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 dotted-grid opacity-40" />
          <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-red-600/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-red-600/5 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:px-8 lg:grid-cols-2 lg:items-center">
          {/* ---- LEFT: animated cursive headline ---- */}
          <motion.div initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:0.6}}>
            <motion.h1 initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.1,duration:0.7}}
              className="text-5xl sm:text-6xl lg:text-7xl font-light leading-[1.05] tracking-tight">
              <span className="block">Test</span>
              <span className="block text-white">your app,</span>
              <motion.span className="block italic font-serif text-red-500"
                initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:0.45,duration:0.7}}>
                with AI.
              </motion.span>
            </motion.h1>
            <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.3,duration:0.6}}
              className="mt-6 max-w-md text-lg font-light text-zinc-400">
              JestBest explores your product, writes the tests, and shows you where it fails — before anything ships.
            </motion.p>
            <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.45,duration:0.6}}
              className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/auth/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-red-700 hover:-translate-y-0.5 transition-all">
                Start testing free <ArrowRight className="h-5 w-5" />
              </Link>
              <button onClick={() => scrollTo('how-it-works')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 text-base font-semibold text-zinc-200 hover:bg-white/5 transition-all">
                <Play className="h-5 w-5 text-red-400" /> See how it works
              </button>
            </motion.div>
          </motion.div>

          {/* ---- RIGHT: live run console ---- */}
          <motion.div initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} transition={{delay:0.3,duration:0.6}}>
            <RunConsole />
          </motion.div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold text-red-500 uppercase tracking-widest">Features</span>
            <h2 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight">Everything your QA team needs</h2>
            <p className="mt-4 text-lg text-zinc-400">Replace scattered test scripts and manual QA with one intelligent platform.</p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="group rounded-2xl border border-white/10 bg-black/50 p-6 hover:border-red-500/40 hover:bg-black transition-all">
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/12 bg-white/5 group-hover:border-red-500/30">
                    <Icon className="h-6 w-6 text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm text-zinc-400">{f.description}</p>
                  <ul className="mt-4 space-y-2">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-zinc-400">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> {b}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how-it-works" className="py-24 lg:py-32 border-t border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold text-red-500 uppercase tracking-widest">How it works</span>
            <h2 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight">From zero to tested in three steps</h2>
          </div>
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {steps.map((s) => (
              <div key={s.step} className="relative rounded-2xl border border-white/10 bg-black/50 p-8 hover:border-red-500/40 transition-colors">
                <span className="text-5xl font-extrabold text-white/15">{s.step}</span>
                <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
                <p className="mt-3 text-sm text-zinc-400">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== AI AGENTS ===== */}
      <section id="agents" className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold text-red-500 uppercase tracking-widest">AI Agents</span>
            <h2 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight">A team of AI agents working around the clock</h2>
            <p className="mt-4 text-lg text-zinc-400">Each agent has one job: keep your product verified.</p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {agents.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.name} className="group rounded-2xl border border-white/10 bg-black/50 p-6 hover:border-red-500/40 transition-all">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-white/5 group-hover:border-red-500/30">
                    <Icon className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <h3 className="font-bold">{a.name}</h3>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">{a.description}</p>
                  <span className="mt-4 inline-block rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">{a.tag}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="py-24 lg:py-32 border-t border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold text-red-500 uppercase tracking-widest">Pricing</span>
            <h2 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight">Simple, transparent pricing</h2>
            <p className="mt-4 text-lg text-zinc-400">Start free. Scale when you are ready.</p>
          </div>
          <div className="mt-16 grid gap-6 lg:grid-cols-3 items-stretch">
            {plans.map((plan) => (
              <div key={plan.name} className={`relative flex flex-col rounded-2xl border p-8 ${plan.highlight ? 'border-red-500/50 bg-black/50' : 'border-white/10 bg-black/50'}`}>
                {plan.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-4 py-1 text-xs font-bold text-white">Most popular</span>}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-1 text-sm text-zinc-400">{plan.description}</p>
                {plan.monthly === null ? (
                  <p className="mt-6 text-4xl font-extrabold">Custom</p>
                ) : (
                  <p className="mt-6 text-4xl font-extrabold">${plan.monthly}<span className="text-sm text-zinc-500">/mo</span></p>
                )}
                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/auth/register" className={`mt-8 inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold ${plan.highlight ? 'bg-red-600 text-white hover:bg-red-700' : 'border border-white/15 text-white hover:bg-white/5'}`}>{plan.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section id="cta" className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/60 px-6 py-16 text-center sm:px-16">
            <div className="dotted-grid absolute inset-0 opacity-25 pointer-events-none" />
            <div className="relative">
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">Ship with confidence, every time</h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">Let AI agents explore, generate, and explain your QA — starting today.</p>
              <Link to="/auth/register" className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-red-700 transition-all">
                Start testing free <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-sm font-semibold text-red-500 uppercase tracking-widest">FAQ</span>
            <h2 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight">Questions? Answered.</h2>
          </div>
          <div className="mt-12 space-y-3">
            {faqs.map((f, i) => (
              <div key={f.q} className="overflow-hidden rounded-xl border border-white/10 bg-black/50">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left hover:bg-white/5 transition-colors">
                  <span className="font-semibold">{f.q}</span>
                  <span className={`text-red-500 transition-transform ${openFaq === i ? 'rotate-45' : ''}`}><Plus className="h-4 w-4" /></span>
                </button>
                {openFaq === i && <div className="px-6 pb-5 text-sm text-zinc-400 border-t border-white/10 pt-4">{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <div className="flex flex-col lg:flex-row items-start justify-between gap-10">
            <div className="max-w-sm">
              <Link to="/" className="flex items-center gap-2.5">
                <Logo variant="mark" size={34} />
              </Link>
              <p className="mt-4 text-sm text-zinc-400">Let agents generate, run, and analyze your tests.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-10">
              <div><h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Product</h4><ul className="mt-4 space-y-3 text-sm">{[['Features','#features'],['Pricing','#pricing'],['FAQ','#faq']].map(([l,h])=>(<li key={l}><a href={h} className="text-zinc-500 hover:text-white">{l}</a></li>))}</ul></div>
              <div><h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">AI</h4><ul className="mt-4 space-y-3 text-sm">{[['Test Explorer','#agents'],['Bug Hunter','#agents'],['Regression Analyst','#agents']].map(([l,h])=>(<li key={l}><a href={h} className="text-zinc-500 hover:text-white">{l}</a></li>))}</ul></div>
              <div><h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Company</h4><ul className="mt-4 space-y-3 text-sm">{[['GitHub','https://github.com'],['Integrations','/integrations']].map(([l,h])=>(<li key={l}><a href={h} target={l==='GitHub'?'_blank':''} rel="noreferrer" className="text-zinc-500 hover:text-white">{l}</a></li>))}</ul></div>
            </div>
          </div>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10 pt-8">
            <p className="text-xs text-zinc-500">&copy; 2026 JestBest, Inc. All rights reserved.</p>
            <div className="flex gap-6 text-xs text-zinc-500"><a href="/integrations" className="hover:text-white">Integrations</a><a href="/settings/profile" className="hover:text-white">Account</a><a href="/dashboard" className="hover:text-white">Dashboard</a></div>
          </div>
        </div>
      </footer>
    </div>
  );
}
