import { Request, Response } from 'express';
import { tokenService } from '../../services/auth/tokenService';
import { userRepository } from '../../repositories/user.repository';
import { passwordService } from '../../services/auth/passwordService';
import { emailService } from '../../services/notification/emailService';
import { ok } from '../../utils/formatters';
import { NotFoundError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { env } from '../../config/environment';

export const requestResetPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email: string };
  const user = await userRepository.findActiveByEmail(email);
  if (user) {
    // Purpose-bound and single-use: see tokenService.issuePasswordResetToken.
    const token = await tokenService.issuePasswordResetToken(user.id);
    const resetUrl = `${env.FRONTEND_ORIGIN}/auth/reset-password?token=${token}`;
    try {
      await emailService.sendPasswordResetEmail(user.email, {
        name: user.name ?? user.email,
        resetUrl,
      });
      if (process.env.NODE_ENV === 'development') {
        console.log(`[email:dev] password reset link for ${email}: ${resetUrl}`);
      }
    } catch (error) {
      console.error(`[email:error] failed to send password reset to ${email}`, error);
    }
  }
  // Always the same response, so this cannot be used to enumerate accounts.
  res.status(200).json(ok(null, { message: Messages.AUTH.RESET_EMAIL_SENT }));
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { token, password } = req.body as { token: string; password: string };
  // Burn the token first: a replayed or repurposed link fails before any work.
  const userId = await tokenService.consumePasswordResetToken(token);
  const user = await userRepository.findActiveById(userId);
  if (!user) {
    throw new NotFoundError('User not found.');
  }
  const passwordHash = await passwordService.hash(password);
  await userRepository.update(user.id, { passwordHash });
  // Invalidate access tokens issued before now, plus every refresh token.
  await tokenService.markPasswordChanged(user.id);
  await tokenService.revokeAllForUser(user.id);
  res.status(200).json(ok(null, { message: Messages.AUTH.PASSWORD_RESET }));
};
