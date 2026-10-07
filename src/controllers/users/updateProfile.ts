import { Request, Response } from 'express';
import { userService } from '../../services/user/userService';
import { UnauthorizedError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

const NOTIFICATION_CHANNELS = ['email', 'slack', 'inapp'];
const NOTIFICATION_EVENTS = [
  'test_run.completed',
  'test_run.failed',
  'bug.created',
  'bug.status_changed',
  'agent.completed',
  'weekly_report',
];

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { name, avatar, notificationPreferences } = req.body as {
    name?: string;
    avatar?: string;
    notificationPreferences?: { channels?: string[]; events?: string[] };
  };
  let prefs: { channels?: string[]; events?: string[] } | undefined;
  if (notificationPreferences) {
    prefs = {
      channels: Array.isArray(notificationPreferences.channels)
        ? notificationPreferences.channels.filter((c) => NOTIFICATION_CHANNELS.includes(c))
        : [],
      events: Array.isArray(notificationPreferences.events)
        ? notificationPreferences.events.filter((e) => NOTIFICATION_EVENTS.includes(e))
        : [],
    };
  }
  const profile = await userService.updateProfile(req.user.id, {
    name,
    avatar,
    notificationPreferences: prefs,
  });
  res.status(200).json(ok(profile));
};
