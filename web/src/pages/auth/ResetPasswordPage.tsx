import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, AlertCircle, Loader2, CheckCircle2, KeyRound } from 'lucide-react';
import { Logo } from '../../components/Logo';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [error, setError] = useState<string | null>(null);

  const validate = (): boolean => {
    const errors: { password?: string; confirmPassword?: string } = {};
    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      errors.password = 'Password must contain at least one letter and one number.';
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Please re-enter your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
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
      await authApi.resetPassword(token!, password);
      toast.success('Password reset successful');
      navigate('/auth/login');
    } catch (error) {
      const message = getErrorMessage(error);
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center  from-background via-background to-red-600/5 p-4 relative overflow-hidden">
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

        {!token ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="glass p-8 rounded-2xl space-y-4 backdrop-blur-xl"
          >
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium">Invalid or expired reset link</p>
                <p>
                  This password reset link is invalid or has expired. Please request a new one to
                  reset your password.
                </p>
              </div>
            </div>
            <div className="text-center">
              <Link to="/auth/forgot-password" className="text-red-500 hover:underline font-medium">
                Request a new reset link
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            onSubmit={handleSubmit}
            className="glass p-8 rounded-2xl space-y-6 backdrop-blur-xl"
          >
            <div>
              <h2 className="text-2xl font-semibold mb-2">Set a new password</h2>
              <p className="text-muted-foreground text-sm">
                Choose a strong password for your account. It must be at least 8 characters and
                contain letters and numbers.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-medium">{error}</p>
                  <p className="text-neutral-400">
                    If your reset link has expired, you can{' '}
                    <Link to="/auth/forgot-password" className="text-red-400 hover:underline font-medium">
                      request a new one
                    </Link>
                    .
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                  }}
                  className={`w-full px-4 py-3 bg-secondary/50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all ${fieldErrors.password ? 'border-red-500/60' : 'border-border'}`}
                  placeholder="Min. 8 characters"
                  required
                  disabled={isLoading}
                />
                {fieldErrors.password && (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {fieldErrors.password}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) setFieldErrors({ ...fieldErrors, confirmPassword: undefined });
                  }}
                  className={`w-full px-4 py-3 bg-secondary/50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all ${fieldErrors.confirmPassword ? 'border-red-500/60' : 'border-border'}`}
                  placeholder="Re-enter your password"
                  required
                  disabled={isLoading}
                />
                {fieldErrors.confirmPassword && (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Password strength hints */}
              <div className="flex flex-wrap gap-3 text-xs">
                <span className={`flex items-center gap-1 ${password.length >= 8 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                  <CheckCircle2 className="w-3 h-3" /> 8+ characters
                </span>
                <span className={`flex items-center gap-1 ${/[A-Za-z]/.test(password) ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                  <CheckCircle2 className="w-3 h-3" /> Letter
                </span>
                <span className={`flex items-center gap-1 ${/\d/.test(password) ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                  <CheckCircle2 className="w-3 h-3" /> Number
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 from-red-600 to-red-600/80 hover:from-red-600/90 hover:to-red-600/70 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  Reset password
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                <Link to="/auth/login" className="text-red-500 hover:underline font-medium">
                  Back to sign in
                </Link>
              </p>
            </div>
          </motion.form>
        )}

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