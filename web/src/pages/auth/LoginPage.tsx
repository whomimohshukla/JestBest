import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Bot, Lock, Mail, ArrowRight, Zap, Bug, GitBranch, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { GitHubIcon } from '../../components/ui/social-icons';

const explainNodes = [
  { icon: Zap, label: 'Agent scans your app', note: 'discovers flows & edge cases', top: '4%', left: '2%' },
  { icon: Bug, label: 'Bugs auto-detected', note: 'root cause, every failure', top: '34%', left: '60%' },
  { icon: GitBranch, label: 'Tests written for you', note: 'resilient suites, kept green', top: '64%', left: '4%' },
  { icon: Database, label: 'Results & analytics', note: 'live dashboards, CI-ready', top: '78%', left: '54%' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ secret: string; otpauthUrl: string; qrDataUrl: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; code?: string }>({});
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const validate = (): boolean => {
    const errors: { email?: string; password?: string; code?: string } = {};
    if (!email.trim()) {
      errors.email = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!password) {
      errors.password = 'Please enter your password.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.dismiss();
    setError(null);
    setFieldErrors({});
    if (!validate()) {
      return;
    }
    setIsLoading(true);
    try {
      const result = await authApi.login(email.trim(), password);
      if ('verificationRequired' in result) {
        navigate(`/auth/verify-email?email=${encodeURIComponent(email.trim())}`);
        toast('Please verify your email to continue. Check your inbox for the verification link.');
        setPassword('');
        return;
      }
      if ('requiresTwoFactor' in result) {
        setTwoFactorToken(result.twoFactorToken);
        setTwoFactorSetup(result.setup ?? null);
        setPassword('');
        return;
      }
      setAuth(result);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      // The form already renders this inline via setError; a dialog here would
      // repeat the same sentence and block the retry.
      const message = getErrorMessage(error);
      setError(message);
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.dismiss();
    setError(null);
    setFieldErrors({});
    if (!code.trim()) {
      setFieldErrors({ code: 'Please enter your 6-digit code.' });
      return;
    }
    setIsLoading(true);
    try {
      const result = await authApi.verify2fa(twoFactorToken!, code.trim());
      setAuth(result);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      const message = getErrorMessage(error);
      setError(message);
      setCode('');
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    if (oauthLoading) return;
    setOauthLoading(true);
    try {
      const { url } = await authApi.oauthAuthorize('github');
      window.location.href = url;
    } catch (error) {
      toast.error(getErrorMessage(error));
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-black text-white relative overflow-hidden">
      {/* dotted backdrop */}
      <div className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-red-600/10 blur-3xl" />

      {/* LEFT: explainer */}
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
          Agents explore, generate, run and explain your QA.
        </motion.p>

        {/* ER / flow diagram */}
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35, duration: 0.6 }}
          className="relative mt-14 h-80">
          <div className="absolute inset-0 rounded-2xl border-2 border-white/15" />
          <div className="absolute inset-3 rounded-xl border border-dashed border-red-500/40" />
          <div className="absolute inset-8 rounded-lg border border-white/10 bg-white/[0.02]" />

          {explainNodes.map((n, i) => (
            <motion.div key={n.label} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.15, type: 'spring', stiffness: 200, damping: 18 }} whileHover={{ scale: 1.06 }}
              className="absolute flex items-start gap-2.5" style={{ top: n.top, left: n.left }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-500/40 bg-black">
                <n.icon className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{n.label}</p>
                <p className="text-xs text-neutral-400">{n.note}</p>
              </div>
            </motion.div>
          ))}

          <svg className="absolute inset-0 h-full w-full pointer-events-none" fill="none">
            <line x1="22%" y1="20%" x2="63%" y2="38%" stroke="rgba(239,68,68,0.45)" strokeWidth="1.5" strokeDasharray="5 5" />
            <line x1="63%" y1="50%" x2="16%" y2="62%" stroke="rgba(239,68,68,0.35)" strokeWidth="1.5" strokeDasharray="5 5" />
            <line x1="16%" y1="72%" x2="52%" y2="80%" stroke="rgba(239,68,68,0.35)" strokeWidth="1.5" strokeDasharray="5 5" />
          </svg>
        </motion.div>
      </div>

      {/* RIGHT: form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="w-full max-w-md">
          {/* mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600">
              <Bot className="h-5 w-5 text-white" />
            </div>
          </div>

          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-none">Welcome back</h1>
              <p className="text-sm text-neutral-400 mt-1">Sign in to continue</p>
            </div>
          </div>

          <form onSubmit={twoFactorToken ? handleTwoFactorSubmit : handleSubmit} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-medium">{error}</p>
                  <p className="text-neutral-400">
                    Forgot your password?{' '}
                    <Link to="/auth/forgot-password" className="text-red-400 hover:underline font-medium">
                      Reset it here
                    </Link>
                  </p>
                </div>
              </div>
            )}

            {twoFactorToken ? (
              <>
                {twoFactorSetup ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20">
                        <Lock className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Two-factor setup required</p>
                        <p className="text-xs text-neutral-400">
                          Your organization requires two-factor authentication. Scan the QR code and enter the code to continue.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center rounded-lg border border-white/10 bg-white p-3">
                      <img src={twoFactorSetup.qrDataUrl} alt="TOTP QR code" className="w-44 h-44 object-contain" />
                    </div>
                    <p className="text-xs text-neutral-500 text-center">
                      Can't scan? Use setup code{' '}
                      <code className="font-mono text-red-400">{twoFactorSetup.secret}</code>
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600/20">
                      <Lock className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Two-factor authentication</p>
                      <p className="text-xs text-neutral-400">Enter the 6-digit code from your authenticator app</p>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Authentication Code
                  </label>
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                    onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); if (fieldErrors.code) setFieldErrors({ ...fieldErrors, code: undefined }); }}
                    className={`w-full px-4 py-3 bg-white/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-center text-2xl tracking-[0.5em] ${fieldErrors.code ? 'border-red-500/60' : 'border-white/10'}`}
                    placeholder="······" required disabled={isLoading} />
                  {fieldErrors.code && (
                    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {fieldErrors.code}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Email Address
                  </label>
                  <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined }); }}
                    className={`w-full px-4 py-3 bg-white/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all ${fieldErrors.email ? 'border-red-500/60' : 'border-white/10'}`}
                    placeholder="you@example.com" required disabled={isLoading} />
                  {fieldErrors.email && (
                    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {fieldErrors.email}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Password
                  </label>
                  <div className="relative">
                    <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined }); }}
                      className={`w-full px-4 py-3 bg-white/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all ${fieldErrors.password ? 'border-red-500/60' : 'border-white/10'}`}
                      placeholder="your password" required disabled={isLoading} />
                    <Link to="/auth/forgot-password" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white">
                      Forgot?
                    </Link>
                  </div>
                  {fieldErrors.password && (
                    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {fieldErrors.password}
                    </p>
                  )}
                </div>
              </>
            )}

            <button type="submit" disabled={isLoading}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group">
              {isLoading ? (<>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verifying...
              </>) : twoFactorToken ? (<>
                Verify Code
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>) : (<>
                Sign In
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>)}
            </button>
          </form>

          {twoFactorToken && (
            <button type="button" onClick={() => { setTwoFactorToken(null); setTwoFactorSetup(null); setCode(''); setError(null); }}
              className="mt-4 w-full text-center text-sm text-neutral-400 hover:text-white transition-colors">
              ← Use a different account
            </button>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-black px-3 text-neutral-400">or continue with</span></div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button type="button" onClick={handleGithubLogin} disabled={isLoading || oauthLoading}
              className="flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors border border-white/10 disabled:opacity-50">
              {oauthLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <GitHubIcon className="w-4 h-4" />
              )}
              Sign in with GitHub
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-neutral-400">
            Don't have an account?{' '}
            <Link to="/auth/register" className="text-red-500 hover:underline font-medium">Sign up free</Link>
          </p>
          <p className="mt-4 text-center text-xs text-neutral-500 flex items-center justify-center gap-1">
            Trusted by QA teams shipping faster <CheckCircle2 className="h-3 w-3 text-red-500" />
          </p>
        </motion.div>
      </div>
    </div>
  );
}
