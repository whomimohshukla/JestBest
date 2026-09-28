import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import {
  Rocket,
  FolderKanban,
  Layers,
  FlaskConical,
  PlaySquare,
  Bug,
  BarChart3,
  BotMessageSquare,
  Plug,
  KeyRound,
  Search,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  icon: typeof Rocket;
  summary: string;
  body: { heading: string; text: string }[];
  code?: { label: string; value: string }[];
}

const SECTIONS: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    icon: Rocket,
    summary: 'Create an account, verify your email, and sign in.',
    body: [
      {
        heading: '1. Create your account',
        text: 'Register from the sign-up page with a valid email and a password of at least 8 characters. Accounts start unverified.',
      },
      {
        heading: '2. Verify your email',
        text: 'A verification link is sent to your inbox. The link is valid for 15 minutes, so click it promptly. You will land on a confirmation screen once your address is verified. If the email has not arrived, use the resend button on the verification screen.',
      },
      {
        heading: '3. Sign in',
        text: 'Return to the sign-in page and use the same credentials. Until your email is verified, sign-in is blocked and you will be redirected back to the verification screen.',
      },
    ],
  },
  {
    id: 'projects',
    title: 'Projects',
    icon: FolderKanban,
    summary: 'Projects are the top-level container for everything else.',
    body: [
      {
        heading: 'What a project holds',
        text: 'Each project owns its applications, test cases, test suites, test runs, and bugs. Nothing is shared between projects, so use separate projects to isolate separate products or environments.',
      },
      {
        heading: 'Creating one',
        text: 'Open Projects and create a project with a name and description. Every other page has a project filter at the top, and a new application must always be attached to a project.',
      },
    ],
  },
  {
    id: 'applications',
    title: 'Applications',
    icon: Layers,
    summary: 'Point JestBest at a web app so agents can explore it.',
    body: [
      {
        heading: 'Adding an application',
        text: 'Create an application under a project and give it the base URL of the site you want tested, for example https://example.com. Supported types are WEB, MOBILE, API, and BROWSER_EXTENSION.',
      },
      {
        heading: 'Running a scan',
        text: 'Starting a scan returns a scan identifier immediately and runs in the background. Poll the scan status to follow progress. The Explorer agent crawls your application and the Test Generator turns what it finds into concrete test cases.',
      },
      {
        heading: 'Good starting targets',
        text: 'Use a stable, public page for your first scan. Pointing the crawler at an application behind a login wall will produce auth-related failures rather than useful tests.',
      },
    ],
  },
  {
    id: 'test-cases',
    title: 'Test cases',
    icon: FlaskConical,
    summary: 'Review, edit, and organise generated and manual tests.',
    body: [
      {
        heading: 'Generated versus manual',
        text: 'Generated cases come from a scan and can be edited or deleted. Manual cases are created by you. Each case has a type, a priority, and a set of ordered steps.',
      },
      {
        heading: 'Editing a case',
        text: 'You can change the title, steps, and priority at any time. Editing a generated case is the intended way to correct an agent mistake before running it.',
      },
    ],
  },
  {
    id: 'test-suites',
    title: 'Test suites',
    icon: Layers,
    summary: 'Group test cases into a reusable regression set.',
    body: [
      {
        heading: 'Building a suite',
        text: 'A suite collects existing test cases into a single named set, which is how you run the same checks repeatedly after a change.',
      },
      {
        heading: 'Running a suite',
        text: 'Running a suite executes every case it contains and produces one test run with a pass and fail summary.',
      },
    ],
  },
  {
    id: 'test-runs',
    title: 'Test runs',
    icon: PlaySquare,
    summary: 'Execute tests in a real browser and review the results.',
    body: [
      {
        heading: 'Execution',
        text: 'Runs execute in a real Chromium browser, so steps that pass here behave the way they would for a user. Runs are asynchronous; the run page shows progress while cases execute.',
      },
      {
        heading: 'After a failure',
        text: 'Open a failed run to see which step failed and the captured evidence. From there you can send the failure to the Failure Analyzer for a root cause, or raise a bug directly.',
      },
      {
        heading: 'Intentionally failing a test',
        text: 'To see the analysis pipeline work, edit a generated case so a step cannot pass, run it, then inspect the output.',
      },
    ],
  },
  {
    id: 'bugs',
    title: 'Bugs',
    icon: Bug,
    summary: 'Track, assign, and resolve defects found by runs and agents.',
    body: [
      {
        heading: 'Where bugs come from',
        text: 'You can raise a bug manually from a failed run, and the Bug Agent can raise them automatically. Each bug has a severity, a priority, a status, and an assignee.',
      },
      {
        heading: 'Working a bug',
        text: 'Assign a bug to a team member, add comments as you investigate, and move it through its status until it is closed.',
      },
    ],
  },
  {
    id: 'agents',
    title: 'AI agents',
    icon: BotMessageSquare,
    summary: 'The automation layer and what each agent does.',
    body: [
      {
        heading: 'Available agents',
        text: 'Explorer discovers an application. Test Generator writes test cases. Failure Analyzer explains why a test failed. Bug Agent files and enriches defects. Healing Agent attempts to repair a broken test. Code Agent and Fix Agent propose source changes.',
      },
      {
        heading: 'Triggering a run',
        text: 'Pick an agent, choose the project and optionally an application, then start it. Runs are queued and appear on the AI Agents page with their status.',
      },
      {
        heading: 'Mock mode',
        text: 'If AI_PROVIDER is set to mock, every agent still runs the full pipeline and writes real records, but the analysis text is generic. The shape of the output is accurate while the reasoning is not.',
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: BarChart3,
    summary: 'Trends across runs, defects, and coverage.',
    body: [
      {
        heading: 'What is shown',
        text: 'Charts summarise pass rate, execution trend, bug counts by severity, and agent activity. Everything is derived from your own runs, so the numbers fill in as you execute tests.',
      },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    icon: Plug,
    summary: 'Connect GitHub, Slack, and Jira.',
    body: [
      {
        heading: 'Connecting a tool',
        text: 'Open Integrations to connect GitHub for repository access, Slack for notifications, and Jira for issue tracking. Webhooks are configured separately under Settings and can post run and bug events to any endpoint.',
      },
      {
        heading: 'Credentials',
        text: 'A tool stays in a not-configured state until you supply its credentials. Pages remain usable while unconnected.',
      },
    ],
  },
  {
    id: 'api-keys',
    title: 'API keys',
    icon: KeyRound,
    summary: 'Authenticate CI jobs and scripts against the API.',
    body: [
      {
        heading: 'Creating a key',
        text: 'Generate a key under Settings to call the REST API from CI. The secret is shown once at creation, so store it immediately.',
      },
      {
        heading: 'Using a key',
        text: 'Send the key in the Authorization header on each request. Keys inherit the permissions of the member who created them and are scoped to that organization.',
      },
    ],
    code: [
      { label: 'Header', value: 'Authorization: Bearer <your_api_key>' },
    ],
  },
];

export default function DocumentationPage() {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = SECTIONS.filter((section) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return (
      section.title.toLowerCase().includes(term) ||
      section.summary.toLowerCase().includes(term) ||
      section.body.some((b) => b.text.toLowerCase().includes(term))
    );
  });

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 gradient-text">Documentation</h1>
          <p className="text-muted-foreground">How JestBest works, from signup to your first test run</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar navigation */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search docs"
                aria-label="Search documentation"
                className="w-full pl-9 pr-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
            </div>

            <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
              {filtered.map((section) => {
                const Icon = section.icon;
                const isActive = section.id === activeId;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveId(section.id)}
                    aria-current={isActive ? 'true' : undefined}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors text-left ${
                      isActive
                        ? 'bg-red-500/10 text-red-500 border border-red-500/30'
                        : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{section.title}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-2">No sections match your search.</p>
              )}
            </nav>
          </aside>

          {/* Content */}
          <div className="space-y-6 min-w-0">
            {filtered.map((section) => {
              const Icon = section.icon;
              return (
                <section key={section.id} id={section.id} className="glass p-6 rounded-xl">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="inline-flex items-center justify-center w-10 h-10 bg-red-500/10 border border-red-500/30 rounded-lg shrink-0">
                      <Icon className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">{section.title}</h2>
                      <p className="text-sm text-muted-foreground">{section.summary}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {section.body.map((block) => (
                      <div key={block.heading}>
                        <h3 className="text-sm font-semibold text-foreground mb-1">{block.heading}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{block.text}</p>
                      </div>
                    ))}
                  </div>

                  {section.code && (
                    <div className="mt-4 space-y-2">
                      {section.code.map((snippet) => (
                        <div
                          key={snippet.value}
                          className="flex items-center justify-between gap-3 px-3 py-2 bg-secondary/50 border border-border rounded-lg"
                        >
                          <code className="text-xs text-muted-foreground font-mono truncate">
                            {snippet.value}
                          </code>
                          <button
                            onClick={() => handleCopy(snippet.value)}
                            aria-label={`Copy ${snippet.label}`}
                            className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            {copied === snippet.value ? (
                              <Check className="w-4 h-4 text-red-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {section.id === 'getting-started' && (
                    <div className="mt-4 flex items-center gap-2">
                      <Link
                        to="/projects"
                        className="inline-flex items-center gap-1 text-sm text-red-500 hover:underline font-medium"
                      >
                        Create your first project
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </section>
              );
            })}

            {filtered.length === 0 && (
              <div className="glass p-8 rounded-xl text-center">
                <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No documentation sections match{' '}
                  <span className="text-foreground font-medium">{query}</span>.
                </p>
                <button onClick={() => setQuery('')} className="mt-4 text-sm text-red-500 hover:underline">
                  Clear search
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}
