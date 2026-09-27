import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Bot, Mail, Lock, User, Building2, ArrowRight, CheckCircle } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { GitHubIcon } from '../../components/ui/social-icons';

export default function RegisterPage() {
  const [formData, setFormData] = useState({ 
    email: '', 
    password: '', 
    name: '', 
    organizationName: '' 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }
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
      toast.success('Account created successfully! 🎉');
      navigate('/dashboard');
    } catch (error) {
      toast.error(getErrorMessage(error));
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

  const features = [
    'AI-powered test generation',
    'Automated bug detection',
    'Real-time analytics dashboard',
    'Seamless CI/CD integration'
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-red-600/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-red-600/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-6xl relative z-10 grid md:grid-cols-2 gap-8 items-center">
        {/* Left side - Features */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden md:block"
        >
          <div className="glass p-8 rounded-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>

                <p className="text-sm text-muted-foreground">QA Automation</p>
              </div>
            </div>
            
            <h3 className="text-xl font-semibold mb-4">Free 14-day trial:</h3>
            <div className="space-y-4">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-border">

              <p className="text-sm text-red-500 font-medium mt-2">- QA Team Lead, TechCorp</p>
            </div>
          </div>
        </motion.div>

        {/* Right side - Registration Form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Mobile Logo */}
          <div className="text-center mb-6 md:hidden">
            <Logo size={40} />
          </div>

          <form onSubmit={handleSubmit} className="glass p-8 rounded-2xl space-y-6 backdrop-blur-xl">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Create your account</h2>
              <p className="text-muted-foreground text-sm">Start automating your QA in minutes</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder="John Doe"
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground mt-1">At least 8 characters</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Organization Name
                </label>
                <input
                  type="text"
                  value={formData.organizationName}
                  onChange={(e) => setFormData({...formData, organizationName: e.target.value})}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder="Acme Inc"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">or sign up with</span></div>
            </div>

            <button
              type="button"
              onClick={handleGithubLogin}
              disabled={isLoading || oauthLoading}
              className="w-full py-3 bg-secondary/50 hover:bg-secondary text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-border"
            >
              {oauthLoading ? (
                <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
              ) : (
                <GitHubIcon className="w-4 h-4" />
              )}
              {oauthLoading ? 'Redirecting to GitHub…' : 'Continue with GitHub'}
            </button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/auth/login" className="text-red-500 hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              By signing up, you agree to our Terms of Service and Privacy Policy
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
