import { emailService } from './emailService';
import { slackService } from '../integration/slack/slackService';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { env } from '../../config/environment';

/**
 * Central notification service that coordinates email, Slack, and other notifications
 */
export const notificationService = {
  /**
   * Send notification when user registers
   */
  async notifyUserRegistered(
    user: { id: string; email: string; name: string | null },
    verificationToken?: string
  ): Promise<void> {
    try {
      const verificationUrl = verificationToken
        ? `${env.APP_ORIGIN}/auth/verify-email?token=${verificationToken}`
        : undefined;

      await emailService.sendWelcomeEmail(user.email, {
        name: user.name || 'there',
        verificationUrl,
      });

      logger.info({ userId: user.id }, 'Welcome email sent');
    } catch (error) {
      logger.error({ error, userId: user.id }, 'Failed to send welcome email');
    }
  },

  /**
   * Send email verification
   */
  async notifyEmailVerification(
    user: { email: string; name: string | null },
    verificationToken: string
  ): Promise<void> {
    try {
      const verificationUrl = `${env.APP_ORIGIN}/auth/verify-email?token=${verificationToken}`;

      await emailService.sendVerificationEmail(user.email, {
        name: user.name || 'there',
        verificationUrl,
      });

      logger.info({ email: user.email }, 'Verification email sent');
    } catch (error) {
      logger.error({ error, email: user.email }, 'Failed to send verification email');
    }
  },

  /**
   * Send password reset email
   */
  async notifyPasswordReset(user: { email: string; name: string | null }, resetToken: string): Promise<void> {
    try {
      const resetUrl = `${env.APP_ORIGIN}/auth/reset-password?token=${resetToken}`;

      await emailService.sendPasswordResetEmail(user.email, {
        name: user.name || 'there',
        resetUrl,
      });

      logger.info({ email: user.email }, 'Password reset email sent');
    } catch (error) {
      logger.error({ error, email: user.email }, 'Failed to send password reset email');
    }
  },

  /**
   * Send team invitation
   */
  async notifyTeamInvitation(invitation: {
    email: string;
    inviterName: string;
    organizationName: string;
    role: string;
    invitationToken?: string;
  }): Promise<void> {
    try {
      const invitationUrl = invitation.invitationToken
        ? `${env.APP_ORIGIN}/invitations/accept?token=${invitation.invitationToken}`
        : `${env.APP_ORIGIN}/auth/login`;

      await emailService.sendTeamInvitationEmail(invitation.email, {
        inviterName: invitation.inviterName,
        organizationName: invitation.organizationName,
        role: invitation.role,
        invitationUrl,
      });

      logger.info({ email: invitation.email }, 'Team invitation email sent');
    } catch (error) {
      logger.error({ error, email: invitation.email }, 'Failed to send invitation email');
    }
  },

  /**
   * Notify when test run completes
   */
  async notifyTestRunCompleted(testRun: {
    id: string;
    projectId: string;
    status: string;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    duration: number | null;
  }): Promise<void> {
    try {
      // Get project details
      const project = await prisma.project.findUnique({
        where: { id: testRun.projectId },
        include: {
          organization: {
            include: {
              members: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      if (!project) return;

      const testRunUrl = `${env.APP_ORIGIN}/runs/${testRun.id}`;

      // Get failed test details if there are failures
      let failedTests: Array<{ title: string; errorMessage?: string }> = [];
      if (testRun.failedTests > 0) {
        const results = await prisma.testResult.findMany({
          where: {
            testRunId: testRun.id,
            status: 'FAILED',
          },
          include: {
            testCase: {
              select: {
                title: true,
              },
            },
          },
          take: 10,
        });

        failedTests = results.map((r) => ({
          title: r.testCase.title,
          errorMessage: r.errorMessage || undefined,
        }));
      }

      // Send emails to team members
      const emails = project.organization.members
        .filter((m) => m.user.emailVerified)
        .map((m) => m.user.email);

      if (emails.length === 0) return;

      if (testRun.status === 'FAILED') {
        // Send failure notifications
        for (const email of emails) {
          await emailService.sendTestFailureEmail(email, {
            projectName: project.name,
            testRunId: testRun.id,
            failedCount: testRun.failedTests,
            passedCount: testRun.passedTests,
            totalCount: testRun.totalTests,
            failedTests,
            testRunUrl,
          });
        }

        // Send Slack notification if configured
        await this.sendSlackNotification(project.organizationId, 'test_failure', {
          projectName: project.name,
          testRunId: testRun.id,
          failedCount: testRun.failedTests,
          passedCount: testRun.passedTests,
          totalCount: testRun.totalTests,
          failedTests,
          testRunUrl,
        });
      } else if (testRun.status === 'PASSED') {
        // Send success notification (optional, could be configurable)
        for (const email of emails) {
          await emailService.sendTestSuccessEmail(email, {
            projectName: project.name,
            totalCount: testRun.totalTests,
            duration: testRun.duration || 0,
            testRunUrl,
          });
        }

        // Send Slack success notification
        await this.sendSlackNotification(project.organizationId, 'test_success', {
          projectName: project.name,
          testRunId: testRun.id,
          totalCount: testRun.totalTests,
          duration: testRun.duration || 0,
          testRunUrl,
        });
      }

      logger.info({ testRunId: testRun.id, status: testRun.status }, 'Test run notifications sent');
    } catch (error) {
      logger.error({ error, testRunId: testRun.id }, 'Failed to send test run notifications');
    }
  },

  /**
   * Notify when bug is created
   */
  async notifyBugCreated(bug: {
    id: string;
    title: string;
    description: string | null;
    severity: string;
    priority: string;
    projectId: string;
    organizationId: string;
  }): Promise<void> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: bug.projectId },
        include: {
          organization: {
            include: {
              members: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      if (!project) return;

      const bugUrl = `${env.APP_ORIGIN}/bugs/${bug.id}`;

      // Send emails to team members
      const emails = project.organization.members
        .filter((m) => m.user.emailVerified)
        .map((m) => m.user.email);

      for (const email of emails) {
        await emailService.sendBugCreatedEmail(email, {
          bugTitle: bug.title,
          severity: bug.severity,
          priority: bug.priority,
          projectName: project.name,
          bugUrl,
          description: bug.description || undefined,
        });
      }

      // Send Slack notification
      await this.sendSlackNotification(bug.organizationId, 'bug_created', {
        bugTitle: bug.title,
        bugId: bug.id,
        severity: bug.severity,
        priority: bug.priority,
        projectName: project.name,
        bugUrl,
      });

      // Send critical alert if bug is critical
      if (bug.severity === 'CRITICAL') {
        for (const email of emails) {
          await emailService.sendCriticalBugAlertEmail(email, {
            bugTitle: bug.title,
            projectName: project.name,
            environment: 'PRODUCTION', // TODO: Get from bug metadata
            bugUrl,
            description: bug.description || 'Critical bug detected',
          });
        }
      }

      logger.info({ bugId: bug.id, severity: bug.severity }, 'Bug notifications sent');
    } catch (error) {
      logger.error({ error, bugId: bug.id }, 'Failed to send bug notifications');
    }
  },

  /**
   * Notify when bug is assigned
   */
  async notifyBugAssigned(
    bug: {
      id: string;
      title: string;
      severity: string;
      priority: string;
      projectId: string;
      assigneeId: string;
    },
    assignedBy: { name: string | null }
  ): Promise<void> {
    try {
      const [assignee, project] = await Promise.all([
        prisma.user.findUnique({ where: { id: bug.assigneeId } }),
        prisma.project.findUnique({ where: { id: bug.projectId } }),
      ]);

      if (!assignee || !project || !assignee.emailVerified) return;

      const bugUrl = `${env.APP_ORIGIN}/bugs/${bug.id}`;

      await emailService.sendBugAssignedEmail(assignee.email, {
        assigneeName: assignee.name || 'there',
        bugTitle: bug.title,
        severity: bug.severity,
        priority: bug.priority,
        projectName: project.name,
        bugUrl,
        assignedBy: assignedBy.name || 'Team member',
      });

      logger.info({ bugId: bug.id, assigneeId: bug.assigneeId }, 'Bug assignment notification sent');
    } catch (error) {
      logger.error({ error, bugId: bug.id }, 'Failed to send bug assignment notification');
    }
  },

  /**
   * Send Slack notification if integration is configured
   */
  async sendSlackNotification(organizationId: string, type: string, data: any): Promise<void> {
    try {
      const integration = await prisma.integration.findFirst({
        where: {
          organizationId,
          type: 'SLACK',
          isActive: true,
        },
      });

      if (!integration) return;

      const config = integration.config as any;

      if (type === 'test_failure') {
        await slackService.sendTestFailureNotification(config, data);
      } else if (type === 'test_success') {
        await slackService.sendTestSuccessNotification(config, data);
      } else if (type === 'bug_created') {
        await slackService.sendBugNotification(config, data);
      }

      logger.info({ organizationId, type }, 'Slack notification sent');
    } catch (error) {
      logger.error({ error, organizationId, type }, 'Failed to send Slack notification');
    }
  },

  /**
   * Send weekly digest to users
   */
  async sendWeeklyDigests(): Promise<void> {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get all active users
      const users = await prisma.user.findMany({
        where: {
          emailVerified: { not: null },
          deletedAt: null,
        },
        include: {
          memberships: {
            include: {
              organization: {
                include: {
                  projects: true,
                },
              },
            },
          },
        },
      });

      for (const user of users) {
        // Get user's stats for the week
        const projectIds = user.memberships.flatMap((m) => m.organization.projects.map((p) => p.id));

        if (projectIds.length === 0) continue;

        const [testRuns, bugs] = await Promise.all([
          prisma.testRun.findMany({
            where: {
              projectId: { in: projectIds },
              createdAt: { gte: oneWeekAgo },
            },
          }),
          prisma.bug.findMany({
            where: {
              projectId: { in: projectIds },
              createdAt: { gte: oneWeekAgo },
            },
          }),
        ]);

        const testsRun = testRuns.reduce((sum, tr) => sum + tr.totalTests, 0);
        const testsPassed = testRuns.reduce((sum, tr) => sum + tr.passedTests, 0);
        const testsFailed = testRuns.reduce((sum, tr) => sum + tr.failedTests, 0);
        const bugsFound = bugs.length;
        const bugsFixed = bugs.filter((b) => b.status === 'FIXED' || b.status === 'VERIFIED').length;

        // Get top projects
        const projectStats = projectIds
          .map((projectId) => {
            const projectRuns = testRuns.filter((tr) => tr.projectId === projectId);
            const project = user.memberships
              .flatMap((m) => m.organization.projects)
              .find((p) => p.id === projectId);

            const passed = projectRuns.reduce((sum, tr) => sum + tr.passedTests, 0);
            const total = projectRuns.reduce((sum, tr) => sum + tr.totalTests, 0);

            return {
              name: project?.name || 'Unknown',
              testsRun: total,
              passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
            };
          })
          .filter((p) => p.testsRun > 0)
          .sort((a, b) => b.testsRun - a.testsRun)
          .slice(0, 3);

        if (testsRun === 0 && bugsFound === 0) continue; // Skip if no activity

        const weekStart = oneWeekAgo.toISOString().split('T')[0];
        const weekEnd = new Date().toISOString().split('T')[0];

        await emailService.sendWeeklyDigestEmail(user.email, {
          name: user.name || 'there',
          weekStart,
          weekEnd,
          stats: {
            testsRun,
            testsPassed,
            testsFailed,
            bugsFound,
            bugsFixed,
            topProjects: projectStats,
          },
        });

        logger.info({ userId: user.id }, 'Weekly digest sent');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to send weekly digests');
    }
  },
};
