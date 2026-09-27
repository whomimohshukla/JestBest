import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Bot, Sparkles, CheckCircle2, AlertCircle, Mail, Loader2 } from 'lucide-react';
import { PageLoader } from '../../components/ui';

type Status = 'idle' | 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const email = searchParams.get('email') ?? '';

  const [status, setStatus] = useState<Status>(token ? 'verifying' : email ? 'idle' : 'error');
  const [errorMessage, setErrorMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const hasRun = useRef(false);

  const verify = useCallback(async () => {
    if (!token || hasRun.current) return;
    hasRun.current = true;

    // No setStatus('verifying') here: status already initialises to 'verifying'
    // when a token is present, and this only runs from the mount effect. Setting
    // it synchronously in the effect body would cause a cascading render.
    try {
      await authApi.verifyEmail(token);
      setStatus('success');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setStatus('error');
    }
  }, [token]);

  // Consuming the emailed link is a one-shot side effect that must run when
  // this page mounts, so an effect is correct here. verify() only calls setState
  // after its first `await`, so this does not cause a cascading render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) verify();
  }, [token, verify]);

  // The "no token" case is static, so derive it instead of storing it in state.
  const displayedError =
    errorMessage || (!token ? 'This verification link is invalid or has expired.' : '');

  const handleResend = async () => {
    if (!email) return;
    setIsResending(true);
    try {
      await authApi.resendVerification(email);
      toast.success('Verification email resent');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsResending(false);
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
            className="inline-flex items-center justify-center w-16 h-16  from-red-600 to-red-600/80 rounded-2xl mb-4"
          >
            <Bot className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-4xl font-bold gradient-text mb-2 flex items-center justify-center gap-2">
            VeriBot
            <Sparkles className="w-6 h-6 text-red-500 animate-pulse" />
          </h1>
          <p className="text-muted-foreground">AI-Powered QA Automation Platform</p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass p-8 rounded-2xl backdrop-blur-xl"
        >
          {status === 'verifying' && (
            <PageLoader label="Verifying your email…" />
          )}

          {status === 'idle' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full mx-auto">
                <Mail className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Check your inbox</h2>
                <p className="text-muted-foreground text-sm">
                  We sent a verification link to <span className="text-white font-medium">{email || 'your email'}</span>.
                  Click it to verify your account, then sign in.
                </p>
              </div>
              <button
                onClick={handleResend}
                disabled={isResending}
                className="w-full py-3 bg-gradient-to-r from-red-600 to-red-600/80 hover:from-red-600/90 hover:to-red-600/70 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Resending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Resend verification email
                  </>
                )}
              </button>
              <button
                onClick={() => navigate('/auth/login')}
                className="w-full py-3 border border-white/10 text-muted-foreground hover:text-white rounded-lg transition-all"
              >
                Back to sign in
              </button>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6"
            >
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 border border-green-500/30 rounded-full mx-auto"
              >
                <CheckCircle2 className="w-8 h-8 text-red-500" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Email verified!</h2>
                <p className="text-muted-foreground text-sm">
                  You can now sign in to your account.
                </p>
              </div>
              <button
                onClick={() => navigate('/auth/login')}
                className="w-full py-3  from-red-600 to-red-600/80 hover:from-red-600/90 hover:to-red-600/70 text-white font-medium rounded-lg transition-all"
              >
                Sign in
              </button>
            </motion.div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full mx-auto">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Verification failed</h2>
                <p className="text-muted-foreground text-sm">
                  {displayedError || 'Something went wrong while verifying your email.'}
                </p>
              </div>

              {email ? (
                <button
                  onClick={handleResend}
                  disabled={isResending}
                  className="w-full py-3  from-red-600 to-red-600/80 hover:from-red-600/90 hover:to-red-600/70 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Resending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Resend verification email
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => navigate('/auth/login')}
                  className="w-full py-3  from-red-600 to-red-600/80 hover:from-red-600/90 hover:to-red-600/70 text-white font-medium rounded-lg transition-all"
                >
                  Back to sign in
                </button>
              )}
            </div>
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