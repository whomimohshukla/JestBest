import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { PageLoader } from '../../components/ui';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const provider = searchParams.get('provider');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const [errorMessage, setErrorMessage] = useState('');
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!provider || !code) {
      // Cancelled at the provider, not a crash. This fires on the login page
      // after redirect, so it is a warning the user dismisses, not an error.
      toast.warning(
        provider
          ? `${provider} sign-in was cancelled or came back without a code. Nothing was changed.`
          : 'Sign-in was cancelled before it started. Nothing was changed.'
      );
      navigate('/auth/login');
      return;
    }

    const handleCallback = async () => {
      try {
        const result = await authApi.oauthCallback(provider, code, state ?? undefined);
        setAuth(result);
        toast.success('Welcome to JestBest');
        navigate('/dashboard');
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      }
    };

    handleCallback();
  }, [provider, code, state, navigate, setAuth]);

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

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass p-8 rounded-2xl backdrop-blur-xl"
        >
          {!provider || !code ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-red-500" />
              Redirecting…
            </div>
          ) : errorMessage ? (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full mx-auto">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Sign in failed</h2>
                <p className="text-muted-foreground text-sm">
                  {errorMessage}
                </p>
              </div>
              <Link
                to="/auth/login"
                className="block w-full py-3  from-red-600 to-red-600/80 hover:from-red-600/90 hover:to-red-600/70 text-white font-medium rounded-lg transition-all text-center"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <PageLoader label="Completing sign in…" />
          )}
        </motion.div>

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