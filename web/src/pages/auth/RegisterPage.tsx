import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { Button } from '../../components/ui';
import { Input } from '../../components/ui';
import { FieldError } from '../../components/ui';
import { GitHubIcon, GoogleIcon } from '../../components/ui/social-icons';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    organizationName: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof formData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const update = (key: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<keyof typeof formData, string>> = {};
    if (!formData.email.trim()) next.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()))
      next.email = 'Enter a valid email address.';
    if (formData.password.length < 8) next.password = 'Password must be at least 8 characters long.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setIsLoading(true);

    try {
      const result = await authApi.register({
        email: formData.email,
        password: formData.password,
        name: formData.name || undefined,
        organizationName: formData.organizationName || undefined,
      });
      if ('verificationRequired' in result) {
        navigate(`/auth/verify-email?email=${encodeURIComponent(formData.email)}`);
        toast('Account created! Please verify your email to get started.');
        return;
      }
      setAuth(result);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'github' | 'google') => {
    if (oauthLoading) return;
    setOauthLoading(provider);
    try {
      const { url } = await authApi.oauthAuthorize(provider);
      window.location.href = url;
    } catch (error) {
      toast.error(getErrorMessage(error));
      setOauthLoading(null);
    }
  };

  const fieldClass = 'h-11 bg-secondary/40';
  // Invalid fields get a red ring so the message below reads as belonging to it.
  const fieldClassFor = (key: keyof typeof formData) =>
    `${fieldClass} ${errors[key] ? 'border-red-500/70 ring-1 ring-red-500/40' : ''}`;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-black px-4 py-8 sm:px-6">
      {/* static brand glow — no pulse animation, it just muddies the backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(55% 45% at 25% 15%, hsl(0 60% 30% / 0.22) 0%, transparent 65%), radial-gradient(50% 45% at 85% 90%, hsl(0 70% 28% / 0.14) 0%, transparent 70%)',
        }}
      />

      {/* my-auto centres the row when it fits and never clips the top when the
          viewport is too short — justify-center would do both badly */}
      <div className="relative z-10 my-auto mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:gap-16">
        {/* LEFT: logo + plain copy, nothing else */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="hidden lg:flex lg:max-w-md lg:flex-col lg:pt-7"
        >
          <div className="mb-10">
            <Logo size={40} />
          </div>

          <h2 className="text-[2.4rem] font-semibold leading-[1.1] tracking-tight text-balance">
            Find bugs before your users do
          </h2>

          <p className="mt-5 text-muted-foreground">
            JestBest explores your app, writes the tests, triages every failure and opens the fix
            — then runs it again to prove it holds.
          </p>

          <div className="mt-9 space-y-3 border-l border-border pl-5">
            <p className="text-sm text-muted-foreground">
              Tests generated from real user flows
            </p>
            <p className="text-sm text-muted-foreground">
              Failures triaged to a root cause
            </p>
            <p className="text-sm text-muted-foreground">
              One command inside your CI pipeline
            </p>
          </div>
        </motion.div>

        {/* RIGHT: signup form */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full"
        >
          <div className="mb-6 lg:hidden">
            <Logo size={40} />
          </div>

          <div className="glass mx-auto w-full max-w-md rounded-2xl p-6 shadow-xl shadow-black/40 sm:p-7">
            <div className="mb-5 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Start automating your QA in minutes
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
                  Full name
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={update('name')}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                  Work email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={update('email')}
                  required
                  disabled={isLoading}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className={fieldClassFor('email')}
                />
                <FieldError id="email-error">{errors.email}</FieldError>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={formData.password}
                    onChange={update('password')}
                    required
                    minLength={8}
                    disabled={isLoading}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    className={`${fieldClassFor('password')} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={isLoading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <FieldError id="password-error">{errors.password}</FieldError>
              </div>

              <div>
                <label htmlFor="organizationName" className="mb-1.5 block text-sm font-medium">
                  Organization{' '}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  autoComplete="organization"
                  placeholder="Your company"
                  value={formData.organizationName}
                  onChange={update('organizationName')}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </div>

              <Button type="submit" size="lg" disabled={isLoading} className="group mt-1.5 w-full">
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Creating account…
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => handleOAuthLogin('github')}
              disabled={isLoading || oauthLoading !== null}
              className="w-full"
            >
              {oauthLoading === 'github' ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
              ) : (
                <GitHubIcon className="h-4 w-4" />
              )}
              {oauthLoading === 'github' ? 'Redirecting to GitHub…' : 'Continue with GitHub'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => handleOAuthLogin('google')}
              disabled={isLoading || oauthLoading !== null}
              className="w-full"
            >
              {oauthLoading === 'google' ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
              ) : (
                <GoogleIcon className="h-4 w-4" />
              )}
              {oauthLoading === 'google' ? 'Redirecting to Google…' : 'Continue with Google'}
            </Button>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/auth/login" className="font-medium text-red-500 hover:underline">
                Sign in
              </Link>
            </p>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              By creating an account you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
