import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api';
import { authApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import { PageLoader, Select, FieldError , ButtonLoader } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import {
  KeyRound,
  RefreshCw,
  User,
  ShieldCheck,
  ShieldOff,
  QrCode,
  MailCheck,
  MailWarning,
  Clock,
  Trash2,
  Upload,
  ImageIcon,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export default function ProfileSettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const { data: me, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['me'],
    queryFn: () => usersApi.me(),
  });

  const [form, setForm] = useState({ name: '', avatar: '' });
  const [formInitialized, setFormInitialized] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmNewPassword?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ secret: string; otpauthUrl: string; qrDataUrl: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const [suspendDays, setSuspendDays] = useState(7);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Seed from the server response during render; an effect would render one
  // frame with the defaults and then cascade.
  const [suspensionBaseline] = useState(() => Date.now());
  if (me && !formInitialized) {
    setForm({ name: me.name ?? '', avatar: me.avatar ?? '' });
    setFormInitialized(true);
  }

  const updateProfileMutation = useMutation({
    mutationFn: (data: { name: string; avatar: string }) => usersApi.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile updated successfully!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      usersApi.changePassword(data),
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      toast.success('Password changed successfully!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const setupTwoFactorMutation = useMutation({
    mutationFn: (password: string) => usersApi.setup2fa({ password }),
    onSuccess: (data) => {
      setTwoFactorSetup(data);
      setTwoFactorCode('');
      toast.success('Scan the QR code, then enter a code to enable.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const enableTwoFactorMutation = useMutation({
    mutationFn: (code: string) => usersApi.enable2fa({ code }),
    onSuccess: () => {
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      setTwoFactorPassword('');
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Two-factor authentication enabled!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const disableTwoFactorMutation = useMutation({
    mutationFn: (data: { password: string; code?: string }) => usersApi.disable2fa(data),
    onSuccess: () => {
      setDisableCode('');
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Two-factor authentication disabled.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: (email: string) => authApi.resendVerification(email),
    onSuccess: () => {
      toast.success('Verification email sent. Check your inbox.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (days: number) => usersApi.suspendAccount({ days }),
    onSuccess: () => {
      setShowSuspendConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success(`Account suspended for ${suspendDays} day(s).`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => usersApi.reactivateAccount(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Account reactivated.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => usersApi.deleteMe(),
    onSuccess: () => {
      setShowDeleteConfirm(false);
      logout();
      toast.success('Your account has been deleted. Goodbye!');
      navigate('/');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(form);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const next: { currentPassword?: string; newPassword?: string; confirmNewPassword?: string } = {};
    if (!passwordForm.currentPassword) next.currentPassword = 'Enter your current password.';
    if (passwordForm.newPassword.length < 8)
      next.newPassword = 'New password must be at least 8 characters.';
    else if (passwordForm.newPassword !== passwordForm.confirmNewPassword)
      next.confirmNewPassword = 'Passwords do not match.';
    setPasswordErrors(next);
    if (Object.keys(next).length > 0) return;
    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const handleAvatarFile = (file: File) => {
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError('Choose an image under 2MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setAvatarError('That file is not an image.');
      return;
    }
    setAvatarError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, avatar: typeof reader.result === 'string' ? reader.result : '' }));
    };
    // A read failure is a real I/O error, not a validation one, so it stays a dialog.
    reader.onerror = () => toast.error('Could not read the image file.');
    reader.readAsDataURL(file);
  };

  const handleSetup2fa = () => {
    if (!twoFactorPassword) {
      setTwoFactorError('Enter your current password to continue.');
      return;
    }
    setTwoFactorError(null);
    setupTwoFactorMutation.mutate(twoFactorPassword);
  };

  // Compared against a mount-time snapshot, so the value is stable across
  // re-renders instead of being recomputed on every render.
  const isSuspended = me
    ? Boolean(me.suspendedUntil && new Date(me.suspendedUntil).getTime() > suspensionBaseline)
    : false;

  if (isLoading && !me) {
    return <PageLoader label="Loading profile..." />;
  }

  if (isError && !me) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-red-500 font-medium mb-4">Failed to load your profile.</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Email verification banner */}
      {me && !me.emailVerified && (
        <div className="glass p-4 rounded-xl border border-amber-500/30 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <MailWarning className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Your email is not verified</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verify your email to enable password recovery and full access.
              </p>
            </div>
          </div>
          <button
            onClick={() => resendVerificationMutation.mutate(me.email)}
            disabled={resendVerificationMutation.isPending}
            className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30 disabled:opacity-50 flex items-center gap-2"
          >
            {resendVerificationMutation.isPending ? (
              <>
                <ButtonLoader /> Sending...
              </>
            ) : (
              <>
                <MailCheck className="w-4 h-4" /> Resend verification
              </>
            )}
          </button>
        </div>
      )}

      {/* Suspension banner */}
      {isSuspended && (
        <div className="glass p-4 rounded-xl border border-red-500/30 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Account suspended</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your account is suspended until {me?.suspendedUntil ? new Date(me.suspendedUntil).toLocaleString() : 'a later date'}.
              </p>
            </div>
          </div>
          <button
            onClick={() => reactivateMutation.mutate()}
            disabled={reactivateMutation.isPending}
            className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 disabled:opacity-50 flex items-center gap-2"
          >
            {reactivateMutation.isPending ? (
              <>
                <ButtonLoader /> Reactivating...
              </>
            ) : (
              <>Reactivate account</>
            )}
          </button>
        </div>
      )}

      <div className="glass p-6 rounded-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-600/10">
            <User className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Profile</h2>
            <p className="text-sm text-muted-foreground">Update your personal information</p>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="flex items-center gap-4">
            <div
              className="relative w-16 h-16 rounded-full overflow-hidden bg-secondary/60 flex items-center justify-center border border-border cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {form.avatar ? (
                <img src={form.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-muted-foreground" />
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                <Upload className="w-5 h-5 text-white" />
              </span>
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4" /> Upload photo
              </button>
              <p className="text-xs text-muted-foreground mt-1.5">
                JPG, PNG or GIF, under 2MB
              </p>
              <FieldError id="avatar-error">{avatarError}</FieldError>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Your name"
              disabled={updateProfileMutation.isPending}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={me?.email ?? ''}
                readOnly
                disabled
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none opacity-60"
              />
              {me?.emailVerified ? (
                <span className="shrink-0 inline-flex items-center gap-1 text-xs text-emerald-500 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Verified
                </span>
              ) : (
                <span className="shrink-0 inline-flex items-center gap-1 text-xs text-amber-500 font-medium">
                  <AlertTriangle className="w-4 h-4" /> Unverified
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Email cannot be changed here</p>
          </div>

          {form.avatar && (
            <div>
              <label className="block text-sm font-medium mb-2">Avatar URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.avatar.startsWith('data:') ? 'Uploaded image (base64)' : form.avatar}
                  readOnly
                  disabled
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, avatar: '' })}
                  className="shrink-0 px-3 py-3 rounded-lg text-sm font-medium bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-600/90 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <ButtonLoader />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="glass p-6 rounded-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-emerald-600/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
            <p className="text-sm text-muted-foreground">Protect your account with an authenticator app</p>
          </div>
        </div>

        {me?.twoFactorEnabled ? (
          <div className="space-y-4 max-w-md">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-600">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              2FA is currently <span className="font-medium">enabled</span> on your account.
            </div>
            <div>
              <label htmlFor="2fa-disable-pw" className="block text-sm font-medium mb-2">
                Current password
              </label>
              <input
                id="2fa-disable-pw"
                type="password"
                value={twoFactorPassword}
                onChange={(e) => {
                  setTwoFactorPassword(e.target.value);
                  if (twoFactorError) setTwoFactorError(null);
                }}
                className={`w-full px-4 py-3 bg-secondary/50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${twoFactorError ? 'border-red-500/70 ring-1 ring-red-500/40' : 'border-border'}`}
                placeholder="••••••••"
                aria-invalid={!!twoFactorError}
                aria-describedby={twoFactorError ? '2fa-disable-pw-error' : undefined}
              />
              <FieldError id="2fa-disable-pw-error">{twoFactorError}</FieldError>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Authenticator code <span className="text-muted-foreground">(optional, but required to disable)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="123456"
              />
            </div>
            <button
              onClick={() => {
                if (!twoFactorPassword) {
                  setTwoFactorError('Enter your current password to confirm.');
                  return;
                }
                setTwoFactorError(null);
                disableTwoFactorMutation.mutate({ password: twoFactorPassword, code: disableCode || undefined });
              }}
              disabled={disableTwoFactorMutation.isPending}
              className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {disableTwoFactorMutation.isPending ? (
                <>
                  <ButtonLoader /> Disabling...
                </>
              ) : (
                <>
                  <ShieldOff className="w-4 h-4" /> Disable Two-Factor Auth
                </>
              )}
            </button>
          </div>
        ) : twoFactorSetup ? (
          <div className="space-y-4 max-w-md">
            <div className="flex items-start gap-3 rounded-lg bg-secondary/50 border border-border p-4">
              <QrCode className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-sm space-y-2">
                <p className="font-medium">1. Scan the QR code</p>
                <p className="text-muted-foreground text-xs">
                  Open your authenticator app (Google Authenticator, Authy, etc.) and scan this code.
                </p>
                <div className="rounded-lg overflow-hidden w-48 h-48 bg-white p-2">
                  <img src={twoFactorSetup.qrDataUrl} alt="2FA QR code" className="w-full h-full object-contain" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Manual entry code: <code className="font-mono text-red-500">{twoFactorSetup.secret}</code>
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">2. Enter the 6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-center text-xl tracking-[0.4em]"
                placeholder="••••••"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => enableTwoFactorMutation.mutate(twoFactorCode)}
                disabled={enableTwoFactorMutation.isPending || twoFactorCode.length !== 6}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-600/90 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {enableTwoFactorMutation.isPending ? (
                  <>
                    <ButtonLoader /> Enabling...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" /> Enable Two-Factor Auth
                  </>
                )}
              </button>
              <button
                onClick={() => setTwoFactorSetup(null)}
                className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-md">
            <div className="flex items-center gap-2 rounded-lg bg-secondary/50 border border-border p-3 text-sm text-muted-foreground">
              <ShieldOff className="w-4 h-4 shrink-0" />
              2FA is currently <span className="font-medium">disabled</span>. Enable it for stronger security.
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Current password</label>
              <input
                type="password"
                value={twoFactorPassword}
                onChange={(e) => setTwoFactorPassword(e.target.value)}
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="••••••••"
              />
            </div>
            <button
              onClick={handleSetup2fa}
              disabled={setupTwoFactorMutation.isPending}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-600/90 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {setupTwoFactorMutation.isPending ? (
                <>
                  <ButtonLoader /> Preparing...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Set up Two-Factor Auth
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="glass p-6 rounded-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-red-600/10 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Danger Zone</h2>
            <p className="text-sm text-muted-foreground">Suspend or permanently delete your account</p>
          </div>
        </div>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium mb-2">Suspend account for</label>
            <div className="flex items-center gap-3">
              <Select
                value={suspendDays}
                onChange={(e) => setSuspendDays(Number(e.target.value))}
                className="px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {[1, 3, 7, 14, 30].map((d) => (
                  <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>
                ))}
              </Select>
              <button
                onClick={() => setShowSuspendConfirm(true)}
                className="px-4 py-3 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-600/30 text-amber-600 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <Clock className="w-4 h-4" /> Suspend
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Your account will be temporarily locked and sign-in blocked until the period ends.
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-500">Delete account</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permanently delete your account and all associated data. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="shrink-0 px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 text-red-500 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete account
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="glass p-6 rounded-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-red-600/10 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Change Password</h2>
            <p className="text-sm text-muted-foreground">Use at least 8 characters</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="pw-current" className="block text-sm font-medium mb-2">
              Current Password
            </label>
            <input
              id="pw-current"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => {
                setPasswordForm({ ...passwordForm, currentPassword: e.target.value });
                if (passwordErrors.currentPassword)
                  setPasswordErrors((p) => ({ ...p, currentPassword: undefined }));
              }}
              className={`w-full px-4 py-3 bg-secondary/50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${passwordErrors.currentPassword ? 'border-red-500/70 ring-1 ring-red-500/40' : 'border-border'}`}
              placeholder="••••••••"
              disabled={changePasswordMutation.isPending}
              aria-invalid={!!passwordErrors.currentPassword}
              aria-describedby={passwordErrors.currentPassword ? 'pw-current-error' : undefined}
              required
            />
            <FieldError id="pw-current-error">{passwordErrors.currentPassword}</FieldError>
          </div>

          <div>
            <label htmlFor="pw-new" className="block text-sm font-medium mb-2">
              New Password
            </label>
            <input
              id="pw-new"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => {
                setPasswordForm({ ...passwordForm, newPassword: e.target.value });
                if (passwordErrors.newPassword)
                  setPasswordErrors((p) => ({ ...p, newPassword: undefined }));
              }}
              className={`w-full px-4 py-3 bg-secondary/50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${passwordErrors.newPassword ? 'border-red-500/70 ring-1 ring-red-500/40' : 'border-border'}`}
              placeholder="At least 8 characters"
              minLength={8}
              disabled={changePasswordMutation.isPending}
              aria-invalid={!!passwordErrors.newPassword}
              aria-describedby={passwordErrors.newPassword ? 'pw-new-error' : undefined}
              required
            />
            <FieldError id="pw-new-error">{passwordErrors.newPassword}</FieldError>
          </div>

          <div>
            <label htmlFor="pw-confirm" className="block text-sm font-medium mb-2">
              Confirm New Password
            </label>
            <input
              id="pw-confirm"
              type="password"
              value={passwordForm.confirmNewPassword}
              onChange={(e) => {
                setPasswordForm({ ...passwordForm, confirmNewPassword: e.target.value });
                if (passwordErrors.confirmNewPassword)
                  setPasswordErrors((p) => ({ ...p, confirmNewPassword: undefined }));
              }}
              className={`w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${passwordErrors.confirmNewPassword ? 'border-red-500/70 ring-1 ring-red-500/40' : ''}`}
              placeholder="Re-enter new password"
              disabled={changePasswordMutation.isPending}
              aria-invalid={!!passwordErrors.confirmNewPassword}
              aria-describedby={
                passwordErrors.confirmNewPassword ? 'pw-confirm-error' : undefined
              }
              required
            />
            <FieldError id="pw-confirm-error">{passwordErrors.confirmNewPassword}</FieldError>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {changePasswordMutation.isPending ? (
                <>
                  <ButtonLoader />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Suspend confirmation modal */}
      {showSuspendConfirm && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSuspendConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Suspend account?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your account will be locked and sign-in blocked for {suspendDays} day{suspendDays > 1 ? 's' : ''}. You can reactivate it anytime from this page.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSuspendConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => suspendMutation.mutate(suspendDays)}
                disabled={suspendMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-600/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {suspendMutation.isPending ? (
                  <>
                    <ButtonLoader /> Suspending...
                  </>
                ) : (
                  'Suspend account'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Delete your account?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This permanently deletes your account, memberships, and all associated data. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-600/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleteMutation.isPending ? (
                  <>
                    <ButtonLoader /> Deleting...
                  </>
                ) : (
                  'Delete permanently'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}