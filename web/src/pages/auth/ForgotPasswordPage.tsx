import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Logo } from '../../components/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.dismiss();
    setError(null);
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.requestPasswordReset(email.trim());
      toast.success('If that account exists, a reset link has been sent.');
      setSubmitted(true);
    } catch (error) {
      const message = getErrorMessage(error);
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-background via-background to-red-600/5 p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="mb-3 flex justify-center"
          >
            <Logo size={44} />
          </motion.div>
          <p className="text-muted-foreground">AI-Powered QA Automation Platform</p>
        </div>

        {/* Forgot Password Form */}
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="glass p-8 rounded-2xl space-y-6 backdrop-blur-xl"
        >
          <div>
            <h2 className="text-2xl font-semibold mb-2">Reset your password</h2>
            <p className="text-muted-foreground text-sm">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {submitted ? (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium">Reset link sent</p>
                <p className="text-muted-foreground">
                  If an account exists for <span className="font-semibold text-emerald-400">{email}</span>, a
                  password reset link was sent. Check your inbox (and spam folder), then follow the link to
                  set a new password.
                </p>
                <p className="text-muted-foreground pt-1">
                  The link expires after 15 minutes. Didn't receive it? Go back and try again.
                </p>
              </div>
            </div>
          ) : (
            <div>
              {error && (
                <div className="flex items-start gap-3 p-4 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder="you@example.com"
                required
                disabled={isLoading}
              />
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                We'll send a password reset link to this email. Check your inbox (and spam folder)
                and click the link to choose a new password.
              </p>
            </div>
          )}

          {!submitted && (
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-red-600/80 hover:from-red-600/90 hover:to-red-600/70 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  Send reset link
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          )}

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              <Link to="/auth/login" className="text-red-500 hover:underline font-medium">
                Back to sign in
              </Link>
            </p>
          </div>
        </motion.form>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center text-xs text-muted-foreground"
        >
          <p>Trusted by QA teams worldwide</p>
        </motion.div>
      </motion.div>
    </div>
  );
}