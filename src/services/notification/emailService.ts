import { env } from '../../config/environment';
import { logger } from '../../config/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

// Email template base styles
const EMAIL_STYLES = {
  body: 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f7;',
  container: 'max-width: 600px; margin: 0 auto; background: white;',
  header: 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center;',
  content: 'padding: 40px 30px;',
  footer: 'background: #f8f9fa; padding: 30px; text-align: center; color: #6c757d; font-size: 14px; border-top: 1px solid #dee2e6;',
  button: 'display: inline-block; padding: 14px 28px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0;',
  badge: 'display: inline-block; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; margin: 5px;',
};

export const emailService = {
  /**
   * Send email using configured provider
   * Supports: SendGrid, AWS SES, SMTP, log (console)
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    const provider = env.EMAIL_PROVIDER || 'log';
    
    logger.info({ to: options.to, subject: options.subject, provider }, 'Sending email');
    
    try {
      if (provider === 'sendgrid') {
        await this.sendViaSendGrid(options);
      } else if (provider === 'ses') {
        await this.sendViaSES(options);
      } else if (provider === 'smtp') {
        await this.sendViaSMTP(options);
      } else {
        await this.sendViaLog(options);
      }
      
      logger.info({ to: options.to }, 'Email sent successfully');
    } catch (error) {
      logger.error({ error, to: options.to }, 'Failed to send email');
      throw error;
    }
  },
  
  async sendViaSendGrid(options: EmailOptions): Promise<void> {
    const apiKey = env.SENDGRID_API_KEY;
    if (!apiKey) {
      throw new Error('SENDGRID_API_KEY not configured');
    }
    
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: Array.isArray(options.to)
              ? options.to.map((email) => ({ email }))
              : [{ email: options.to }],
          },
        ],
        from: {
          email: env.EMAIL_FROM || 'notifications@jestbest.ai',
          name: 'JestBest',
        },
        subject: options.subject,
        content: [
          {
            type: 'text/html',
            value: options.html,
          },
        ],
      }),
    });
    
    if (!response.ok) {
      throw new Error(`SendGrid API error: ${response.status}`);
    }
  },
  
  async sendViaSES(_options: EmailOptions): Promise<void> {
    // AWS SES integration would go here
    // For now, throw an error
    throw new Error('AWS SES not yet implemented');
  },
  
  async sendViaSMTP(_options: EmailOptions): Promise<void> {
    // SMTP integration would go here
    // For now, just log
    logger.warn('SMTP email sending not implemented, email not sent');
  },

  async sendViaLog(options: EmailOptions): Promise<void> {
    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    // eslint-disable-next-line no-console
    console.log(
      '\n' +
      '='.repeat(72) + '\n' +
      '   JESTBEST OUTGOING EMAIL (log provider)\n' +
      '='.repeat(72) + '\n' +
      `   To:      ${to}\n` +
      `   Subject: ${options.subject}\n` +
      '-'.repeat(72) + '\n' +
      `${options.text ?? options.html}\n` +
      '='.repeat(72) + '\n'
    );

    // Persist to a dev inbox file so links are easy to grab during development
    try {
      const inboxPath = path.resolve(process.cwd(), env.EMAIL_INBOX_FILE);
      const entry = `[${new Date().toISOString()}] ${options.subject} -> ${to}\n${options.text ?? options.html}\n\n`;
      fs.appendFileSync(inboxPath, entry);
    } catch (error) {
      logger.warn({ error }, 'Failed to append email to dev inbox file');
    }
  },
  
  /**
   * Send test failure notification
   */
  async sendTestFailureEmail(
    to: string,
    data: {
      projectName: string;
      testRunId: string;
      failedCount: number;
      passedCount: number;
      totalCount: number;
      failedTests: Array<{ title: string; errorMessage?: string }>;
      testRunUrl: string;
    }
  ): Promise<void> {
    const subject = `❌ Test Failure: ${data.failedCount} test${data.failedCount > 1 ? 's' : ''} failed in ${data.projectName}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
    .stat { text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; }
    .stat-label { color: #666; font-size: 14px; }
    .failed-tests { background: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .test-item { padding: 10px; border-left: 3px solid #dc2626; margin-bottom: 10px; background: #fff5f5; }
    .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">❌ Test Failure Alert</h1>
      <p style="margin:5px 0 0 0;">Project: ${data.projectName}</p>
    </div>
    <div class="content">
      <div class="stats">
        <div class="stat">
          <div class="stat-value" style="color: #dc2626;">${data.failedCount}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: #16a34a;">${data.passedCount}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.totalCount}</div>
          <div class="stat-label">Total</div>
        </div>
      </div>
      
      <div class="failed-tests">
        <h3>Failed Tests:</h3>
        ${data.failedTests
          .slice(0, 5)
          .map(
            (test) => `
          <div class="test-item">
            <strong>${test.title}</strong>
            ${test.errorMessage ? `<p style="margin:5px 0 0 0; color:#666; font-size:14px;">${test.errorMessage}</p>` : ''}
          </div>
        `
          )
          .join('')}
        ${data.failedTests.length > 5 ? `<p><em>...and ${data.failedTests.length - 5} more tests</em></p>` : ''}
      </div>
      
      <center>
        <a href="${data.testRunUrl}" class="button">View Full Test Results</a>
      </center>
    </div>
    <div class="footer">
      <p>This is an automated notification from JestBest</p>
      <p>You're receiving this because you're subscribed to test notifications for ${data.projectName}</p>
    </div>
  </div>
</body>
</html>
    `;
    
    await this.sendEmail({ to, subject, html });
  },
  
  /**
   * Send test success notification
   */
  async sendTestSuccessEmail(
    to: string,
    data: {
      projectName: string;
      totalCount: number;
      duration: number;
      testRunUrl: string;
    }
  ): Promise<void> {
    const subject = `✅ All Tests Passed: ${data.projectName}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #16a34a; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
    .stat { text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #16a34a; }
    .stat-label { color: #666; font-size: 14px; }
    .button { display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">✅ All Tests Passed!</h1>
      <p style="margin:5px 0 0 0;">Project: ${data.projectName}</p>
    </div>
    <div class="content">
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${data.totalCount}</div>
          <div class="stat-label">Tests Passed</div>
        </div>
        <div class="stat">
          <div class="stat-value">${Math.round(data.duration / 1000)}s</div>
          <div class="stat-label">Duration</div>
        </div>
      </div>
      
      <p style="text-align:center; font-size:18px;">🎉 Great job! All tests are passing.</p>
      
      <center>
        <a href="${data.testRunUrl}" class="button">View Test Results</a>
      </center>
    </div>
    <div class="footer">
      <p>This is an automated notification from JestBest</p>
    </div>
  </div>
</body>
</html>
    `;
    
    await this.sendEmail({ to, subject, html });
  },
  
  /**
   * Send welcome email after registration
   */
  async sendWelcomeEmail(
    to: string,
    data: {
      name: string;
      verificationUrl?: string;
    }
  ): Promise<void> {
    const subject = '🎉 Welcome to JestBest - Let\'s Get Started!';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="${EMAIL_STYLES.body}">
  <div style="${EMAIL_STYLES.container}">
    <div style="${EMAIL_STYLES.header}">
      <h1 style="margin: 0; font-size: 32px;">🤖 Welcome to JestBest!</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">AI-Powered Quality Assurance Platform</p>
    </div>
    
    <div style="${EMAIL_STYLES.content}">
      <h2 style="color: #333; margin-top: 0;">Hi ${data.name}! 👋</h2>
      
      <p style="font-size: 16px; line-height: 1.8;">
        Thank you for joining JestBest! We're excited to help you automate your testing and improve your software quality.
      </p>
      
      ${data.verificationUrl ? `
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <p style="margin: 0 0 15px 0; font-weight: 600;">📧 Please verify your email address:</p>
        <center>
          <a href="${data.verificationUrl}" style="${EMAIL_STYLES.button}">Verify Email Address</a>
        </center>
        <p style="margin: 15px 0 0 0; font-size: 14px; color: #6c757d;">
          This link will expire in 24 hours.
        </p>
      </div>
      ` : ''}
      
      <h3 style="color: #667eea; margin-top: 30px;">🚀 Quick Start Guide</h3>
      
      <div style="margin: 20px 0;">
        <div style="padding: 15px; border-left: 4px solid #667eea; background: #f8f9fa; margin-bottom: 15px;">
          <strong>1. Create Your Organization</strong>
          <p style="margin: 5px 0 0 0; color: #666;">Set up your team workspace and invite members</p>
        </div>
        
        <div style="padding: 15px; border-left: 4px solid #667eea; background: #f8f9fa; margin-bottom: 15px;">
          <strong>2. Add Your First Project</strong>
          <p style="margin: 5px 0 0 0; color: #666;">Connect your application and configure test environments</p>
        </div>
        
        <div style="padding: 15px; border-left: 4px solid #667eea; background: #f8f9fa; margin-bottom: 15px;">
          <strong>3. Let AI Discover Your App</strong>
          <p style="margin: 5px 0 0 0; color: #666;">Our AI will automatically map your application flows</p>
        </div>
        
        <div style="padding: 15px; border-left: 4px solid #667eea; background: #f8f9fa;">
          <strong>4. Generate & Run Tests</strong>
          <p style="margin: 5px 0 0 0; color: #666;">AI creates test cases and executes them automatically</p>
        </div>
      </div>
      
      <div style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); padding: 25px; border-radius: 8px; margin: 30px 0;">
        <h3 style="margin: 0 0 15px 0; color: #667eea;">✨ What You Get With JestBest</h3>
        <ul style="margin: 0; padding-left: 20px; color: #555;">
          <li style="margin-bottom: 10px;">🤖 AI-powered test generation</li>
          <li style="margin-bottom: 10px;">🔍 Automatic bug detection</li>
          <li style="margin-bottom: 10px;">📊 Real-time analytics dashboard</li>
          <li style="margin-bottom: 10px;">🔗 GitHub, Jira, Slack integrations</li>
          <li style="margin-bottom: 10px;">🎥 Video recordings of test failures</li>
          <li>💡 AI-powered failure analysis</li>
        </ul>
      </div>
      
      <center>
        <a href="${env.APP_ORIGIN}/dashboard" style="${EMAIL_STYLES.button}">Go to Dashboard</a>
      </center>
      
      <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #dee2e6;">
        <h3 style="color: #333;">Need Help?</h3>
        <p>Check out our resources:</p>
        <p>
          📖 <a href="${env.APP_ORIGIN}/docs" style="color: #667eea;">Documentation</a> | 
          💬 <a href="${env.APP_ORIGIN}/support" style="color: #667eea;">Support</a> | 
          🎥 <a href="${env.APP_ORIGIN}/tutorials" style="color: #667eea;">Video Tutorials</a>
        </p>
      </div>
    </div>
    
    <div style="${EMAIL_STYLES.footer}">
      <p style="margin: 0 0 10px 0;">
        <strong>JestBest</strong> - AI-Powered QA Automation
      </p>
      <p style="margin: 0; font-size: 13px;">
        Questions? Reply to this email or visit our <a href="${env.APP_ORIGIN}/support" style="color: #667eea;">support center</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;
    
    await this.sendEmail({ to, subject, html });
  },
  
  /**
   * Send email verification
   */
  async sendVerificationEmail(
    to: string,
    data: {
      name: string;
      verificationUrl: string;
    }
  ): Promise<void> {
    const subject = '📧 Verify Your JestBest Email Address';
    
    const html = `
<!DOCTYPE html>
<html>
<body style="${EMAIL_STYLES.body}">
  <div style="${EMAIL_STYLES.container}">
    <div style="${EMAIL_STYLES.header}">
      <h1 style="margin: 0; font-size: 28px;">📧 Verify Your Email</h1>
    </div>
    
    <div style="${EMAIL_STYLES.content}">
      <p>Hi ${data.name},</p>
      
      <p style="font-size: 16px;">
        Please verify your email address to activate your JestBest account and start using all features.
      </p>
      
      <center>
        <a href="${data.verificationUrl}" style="${EMAIL_STYLES.button}">Verify Email Address</a>
      </center>
      
      <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
        Or copy and paste this link into your browser:<br>
        <code style="background: #f8f9fa; padding: 8px; display: inline-block; margin-top: 10px; border-radius: 4px; word-break: break-all;">
          ${data.verificationUrl}
        </code>
      </p>
      
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
        <p style="margin: 0; color: #856404;">
          ⏰ <strong>Important:</strong> This verification link expires in 24 hours.
        </p>
      </div>
      
      <p style="color: #6c757d; font-size: 14px;">
        If you didn't create a JestBest account, you can safely ignore this email.
      </p>
    </div>
    
    <div style="${EMAIL_STYLES.footer}">
      <p style="margin: 0;">JestBest - AI-Powered QA Automation</p>
    </div>
  </div>
</body>
</html>
    `;
    
    await this.sendEmail({ to, subject, html });
  },
  
  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    data: {
      name: string;
      resetUrl: string;
    }
  ): Promise<void> {
    const subject = '🔐 Reset Your JestBest Password';
    
    const html = `
<!DOCTYPE html>
<html>
<body style="${EMAIL_STYLES.body}">
  <div style="${EMAIL_STYLES.container}">
    <div style="${EMAIL_STYLES.header}">
      <h1 style="margin: 0; font-size: 28px;">🔐 Password Reset</h1>
    </div>
    
    <div style="${EMAIL_STYLES.content}">
      <p>Hi ${data.name},</p>
      
      <p style="font-size: 16px;">
        We received a request to reset your password. Click the button below to create a new password:
      </p>
      
      <center>
        <a href="${data.resetUrl}" style="${EMAIL_STYLES.button}">Reset Password</a>
      </center>
      
      <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
        Or copy and paste this link:<br>
        <code style="background: #f8f9fa; padding: 8px; display: inline-block; margin-top: 10px; border-radius: 4px; word-break: break-all;">
          ${data.resetUrl}
        </code>
      </p>
      
      <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 25px 0; border-radius: 4px;">
        <p style="margin: 0; color: #721c24;">
          ⏰ <strong>Security Notice:</strong> This link expires in 1 hour for your security.
        </p>
      </div>
      
      <div style="background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 25px 0; border-radius: 4px;">
        <p style="margin: 0; color: #0c5460;">
          🔒 <strong>Didn't request this?</strong> Your account is secure. You can safely ignore this email.
        </p>
      </div>
    </div>
    
    <div style="${EMAIL_STYLES.footer}">
      <p style="margin: 0;">JestBest - AI-Powered QA Automation</p>
    </div>
  </div>
</body>
</html>
    `;
    
    await this.sendEmail({ to, subject, html });
  },
  
  /**
   * Send team invitation email
   */
  async sendTeamInvitationEmail(
    to: string,
    data: {
      inviterName: string;
      organizationName: string;
      role: string;
      invitationUrl: string;
    }
  ): Promise<void> {
    const subject = `👥 ${data.inviterName} invited you to join ${data.organizationName} on JestBest`;
    
    const html = `
<!DOCTYPE html>
<html>
<body style="${EMAIL_STYLES.body}">
  <div style="${EMAIL_STYLES.container}">
    <div style="${EMAIL_STYLES.header}">
      <h1 style="margin: 0; font-size: 28px;">👥 Team Invitation</h1>
    </div>
    
    <div style="${EMAIL_STYLES.content}">
      <p style="font-size: 16px;">
        <strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName}</strong> on JestBest!
      </p>
      
      <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Organization:</strong> ${data.organizationName}</p>
        <p style="margin: 0;"><strong>Your Role:</strong> <span style="${EMAIL_STYLES.badge} background: #667eea; color: white;">${data.role}</span></p>
      </div>
      
      <p>Join the team to collaborate on automated testing and quality assurance!</p>
      
      <center>
        <a href="${data.invitationUrl}" style="${EMAIL_STYLES.button}">Accept Invitation</a>
      </center>
      
      <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
        <h4 style="margin: 0 0 15px 0;">What you'll be able to do:</h4>
        <ul style="margin: 0; padding-left: 20px; color: #555;">
          <li style="margin-bottom: 8px;">Collaborate on test projects</li>
          <li style="margin-bottom: 8px;">View test results and analytics</li>
          <li style="margin-bottom: 8px;">Manage bugs and issues</li>
          <li>Configure integrations</li>
        </ul>
      </div>
      
      <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
        This invitation will expire in 7 days.
      </p>
    </div>
    
    <div style="${EMAIL_STYLES.footer}">
      <p style="margin: 0;">JestBest - AI-Powered QA Automation</p>
    </div>
  </div>
</body>
</html>
    `;
    
    await this.sendEmail({ to, subject, html });
  },

  /**
   * Send weekly digest email
   */
  async sendWeeklyDigestEmail(
    to: string,
    data: {
      name: string;
      weekStart: string;
      weekEnd: string;
      stats: {
        testsRun: number;
        testsPassed: number;
        testsFailed: number;
        bugsFound: number;
        bugsFixed: number;
        topProjects: Array<{ name: string; testsRun: number; passRate: number }>;
      };
    }
  ): Promise<void> {
    const subject = `📊 Your Weekly JestBest Summary (${data.weekStart} - ${data.weekEnd})`;
    const passRate = data.stats.testsRun > 0 
      ? Math.round((data.stats.testsPassed / data.stats.testsRun) * 100) 
      : 0;
    
    const html = `
<!DOCTYPE html>
<html>
<body style="${EMAIL_STYLES.body}">
  <div style="${EMAIL_STYLES.container}">
    <div style="${EMAIL_STYLES.header}">
      <h1 style="margin: 0; font-size: 28px;">📊 Weekly Summary</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${data.weekStart} - ${data.weekEnd}</p>
    </div>
    
    <div style="${EMAIL_STYLES.content}">
      <p>Hi ${data.name},</p>
      
      <p style="font-size: 16px;">
        Here's your testing activity summary for the past week:
      </p>
      
      <div style="display: table; width: 100%; margin: 30px 0;">
        <div style="display: table-row;">
          <div style="display: table-cell; padding: 20px; background: #f0f9ff; border-radius: 8px; margin-right: 10px; text-align: center; width: 33%;">
            <div style="font-size: 36px; font-weight: bold; color: #0284c7;">${data.stats.testsRun}</div>
            <div style="color: #666; font-size: 14px; margin-top: 5px;">Tests Run</div>
          </div>
          <div style="display: table-cell; padding: 5px;"></div>
          <div style="display: table-cell; padding: 20px; background: #f0fdf4; border-radius: 8px; margin: 0 10px; text-align: center; width: 33%;">
            <div style="font-size: 36px; font-weight: bold; color: #16a34a;">${passRate}%</div>
            <div style="color: #666; font-size: 14px; margin-top: 5px;">Pass Rate</div>
          </div>
          <div style="display: table-cell; padding: 5px;"></div>
          <div style="display: table-cell; padding: 20px; background: #fef2f2; border-radius: 8px; text-align: center; width: 33%;">
            <div style="font-size: 36px; font-weight: bold; color: #dc2626;">${data.stats.bugsFound}</div>
            <div style="color: #666; font-size: 14px; margin-top: 5px;">Bugs Found</div>
          </div>
        </div>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0;">📈 Key Metrics</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">✅ Tests Passed</td>
            <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #dee2e6; font-weight: bold; color: #16a34a;">
              ${data.stats.testsPassed}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">❌ Tests Failed</td>
            <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #dee2e6; font-weight: bold; color: #dc2626;">
              ${data.stats.testsFailed}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">🐛 Bugs Found</td>
            <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #dee2e6; font-weight: bold;">
              ${data.stats.bugsFound}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">✨ Bugs Fixed</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #16a34a;">
              ${data.stats.bugsFixed}
            </td>
          </tr>
        </table>
      </div>
      
      ${data.stats.topProjects.length > 0 ? `
      <div style="margin: 30px 0;">
        <h3 style="color: #333;">🏆 Top Active Projects</h3>
        ${data.stats.topProjects.map((project, idx) => `
          <div style="padding: 15px; background: ${idx === 0 ? '#fff7ed' : '#f8f9fa'}; border-left: 4px solid ${idx === 0 ? '#f97316' : '#667eea'}; margin-bottom: 10px; border-radius: 4px;">
            <strong>${project.name}</strong>
            <div style="margin-top: 5px; color: #666; font-size: 14px;">
              ${project.testsRun} tests run • ${project.passRate}% pass rate
            </div>
          </div>
        `).join('')}
      </div>
      ` : ''}
      
      <center>
        <a href="${env.APP_ORIGIN}/dashboard/analytics" style="${EMAIL_STYLES.button}">View Full Analytics</a>
      </center>
      
      <div style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); padding: 20px; border-radius: 8px; margin-top: 30px;">
        <p style="margin: 0; font-size: 14px; color: #555;">
          💡 <strong>Tip:</strong> Keep your pass rate above 95% by fixing flaky tests and addressing bugs promptly.
        </p>
      </div>
    </div>
    
    <div style="${EMAIL_STYLES.footer}">
      <p style="margin: 0 0 10px 0;">JestBest - AI-Powered QA Automation</p>
      <p style="margin: 0; font-size: 12px;">
        <a href="${env.APP_ORIGIN}/settings/notifications" style="color: #667eea;">Manage email preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;
    
    await this.sendEmail({ to, subject, html });
  },
  
  /**
   * Send bug created notification
   */
  async sendBugCreatedEmail(
    to: string,
    data: {
      bugTitle: string;
      severity: string;
      priority: string;
      projectName: string;
      bugUrl: string;
      description?: string;
    }
  ): Promise<void> {
    const subject = `🐛 New Bug Reported: ${data.bugTitle}`;

    const severityColors: Record<string, string> = {
      CRITICAL: '#dc2626',
      HIGH: '#ea580c',
      MEDIUM: '#eab308',
      LOW: '#16a34a',
    };

    const html = `
<!DOCTYPE html>
<html>
<body style="${EMAIL_STYLES.body}">
  <div style="${EMAIL_STYLES.container}">
    <div style="background: ${severityColors[data.severity] || '#667eea'}; color: white; padding: 30px 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">🐛 New Bug Reported</h1>
    </div>

    <div style="${EMAIL_STYLES.content}">
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0;">${data.bugTitle}</h3>
        <div>
          <span style="${EMAIL_STYLES.badge} background: ${severityColors[data.severity]}; color: white;">
            ${data.severity}
          </span>
          <span style="${EMAIL_STYLES.badge} background: #e9ecef; color: #495057;">
            ${data.priority}
          </span>
        </div>
        <p style="margin: 15px 0 0 0; color: #666;">
          <strong>Project:</strong> ${data.projectName}
        </p>
        ${data.description ? `<p style="margin: 15px 0 0 0; color: #555;">${data.description}</p>` : ''}
      </div>

      <center>
        <a href="${data.bugUrl}" style="${EMAIL_STYLES.button}">View Bug Details</a>
      </center>
    </div>

    <div style="${EMAIL_STYLES.footer}">
      <p style="margin: 0;">JestBest - AI-Powered QA Automation</p>
    </div>
  </div>
</body>
</html>
    `;

    await this.sendEmail({ to, subject, html });
  },

  /**
   * Send bug assignment notification
   */
  async sendBugAssignedEmail(
    to: string,
    data: {
      assigneeName: string;
      bugTitle: string;
      severity: string;
      priority: string;
      projectName: string;
      bugUrl: string;
      assignedBy: string;
    }
  ): Promise<void> {
    const subject = `🐛 Bug Assigned to You: ${data.bugTitle}`;
    
    const severityColors: Record<string, string> = {
      CRITICAL: '#dc2626',
      HIGH: '#ea580c',
      MEDIUM: '#eab308',
      LOW: '#16a34a',
    };
    
    const html = `
<!DOCTYPE html>
<html>
<body style="${EMAIL_STYLES.body}">
  <div style="${EMAIL_STYLES.container}">
    <div style="background: ${severityColors[data.severity] || '#667eea'}; color: white; padding: 30px 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">🐛 Bug Assigned</h1>
    </div>
    
    <div style="${EMAIL_STYLES.content}">
      <p>Hi ${data.assigneeName},</p>
      
      <p style="font-size: 16px;">
        <strong>${data.assignedBy}</strong> has assigned a bug to you.
      </p>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0;">${data.bugTitle}</h3>
        <div>
          <span style="${EMAIL_STYLES.badge} background: ${severityColors[data.severity]}; color: white;">
            ${data.severity}
          </span>
          <span style="${EMAIL_STYLES.badge} background: #e9ecef; color: #495057;">
            ${data.priority}
          </span>
        </div>
        <p style="margin: 15px 0 0 0; color: #666;">
          <strong>Project:</strong> ${data.projectName}
        </p>
      </div>
      
      <center>
        <a href="${data.bugUrl}" style="${EMAIL_STYLES.button}">View Bug Details</a>
      </center>
      
      <div style="margin-top: 30px; padding: 15px; background: #e7f3ff; border-left: 4px solid #0284c7; border-radius: 4px;">
        <p style="margin: 0; color: #0c5460;">
          💡 <strong>Quick Actions:</strong> View details, update status, add comments, or link related issues.
        </p>
      </div>
    </div>
    
    <div style="${EMAIL_STYLES.footer}">
      <p style="margin: 0;">JestBest - AI-Powered QA Automation</p>
    </div>
  </div>
</body>
</html>
    `;
    
    await this.sendEmail({ to, subject, html });
  },
  
  /**
   * Send deployment notification
   */
  async sendDeploymentNotificationEmail(
    to: string,
    data: {
      projectName: string;
      environment: string;
      deploymentStatus: 'SUCCESS' | 'FAILED';
      deployedBy: string;
      commitHash?: string;
      testsRun?: number;
      testsPassed?: number;
      deploymentUrl: string;
    }
  ): Promise<void> {
    const isSuccess = data.deploymentStatus === 'SUCCESS';
    const subject = `${isSuccess ? '✅' : '❌'} Deployment ${data.deploymentStatus}: ${data.projectName} to ${data.environment}`;
    
    const html = `
<!DOCTYPE html>
<html>
<body style="${EMAIL_STYLES.body}">
  <div style="${EMAIL_STYLES.container}">
    <div style="background: ${isSuccess ? '#16a34a' : '#dc2626'}; color: white; padding: 30px 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">${isSuccess ? '✅' : '❌'} Deployment ${data.deploymentStatus}</h1>
    </div>
    
    <div style="${EMAIL_STYLES.content}">
      <h2 style="margin-top: 0;">${data.projectName}</h2>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0;"><strong>Environment:</strong></td>
            <td style="padding: 8px 0; text-align: right;">
              <span style="${EMAIL_STYLES.badge} background: #667eea; color: white;">${data.environment}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Deployed By:</strong></td>
            <td style="padding: 8px 0; text-align: right;">${data.deployedBy}</td>
          </tr>
          ${data.commitHash ? `
          <tr>
            <td style="padding: 8px 0;"><strong>Commit:</strong></td>
            <td style="padding: 8px 0; text-align: right;"><code>${data.commitHash.substring(0, 7)}</code></td>
          </tr>
          ` : ''}
          ${data.testsRun ? `
          <tr>
            <td style="padding: 8px 0;"><strong>Tests Run:</strong></td>
            <td style="padding: 8px 0; text-align: right;">${data.testsPassed}/${data.testsRun} passed</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0;"><strong>Status:</strong></td>
            <td style="padding: 8px 0; text-align: right;">
              <span style="${EMAIL_STYLES.badge} background: ${isSuccess ? '#16a34a' : '#dc2626'}; color: white;">
                ${data.deploymentStatus}
              </span>
            </td>
          </tr>
        </table>
      </div>
      
      ${isSuccess ? `
      <div style="background: #d1f4e0; border-left: 4px solid #16a34a; padding: 15px; margin: 25px 0; border-radius: 4px;">
        <p style="margin: 0; color: #0f5132;">
          ✨ <strong>Deployment successful!</strong> Your application is now live on ${data.environment}.
        </p>
      </div>
      ` : `
      <div style="background: #f8d7da; border-left: 4px solid #dc2626; padding: 15px; margin: 25px 0; border-radius: 4px;">
        <p style="margin: 0; color: #721c24;">
          ⚠️ <strong>Deployment failed!</strong> Please check the logs for more details.
        </p>
      </div>
      `}
      
      <center>
        <a href="${data.deploymentUrl}" style="${EMAIL_STYLES.button}">View Deployment Details</a>
      </center>
    </div>
    
    <div style="${EMAIL_STYLES.footer}">
      <p style="margin: 0;">JestBest - AI-Powered QA Automation</p>
    </div>
  </div>
</body>
</html>
    `;
    
    await this.sendEmail({ to, subject, html });
  },
  
  /**
   * Send critical bug alert
   */
  async sendCriticalBugAlertEmail(
    to: string,
    data: {
      bugTitle: string;
      projectName: string;
      environment: string;
      affectedUsers?: number;
      errorRate?: number;
      bugUrl: string;
      description: string;
    }
  ): Promise<void> {
    const subject = `🚨 CRITICAL BUG ALERT: ${data.bugTitle}`;
    
    const html = `
<!DOCTYPE html>
<html>
<body style="${EMAIL_STYLES.body}">
  <div style="${EMAIL_STYLES.container}">
    <div style="background: #dc2626; color: white; padding: 30px 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 32px;">🚨 CRITICAL BUG</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px;">Immediate Action Required</p>
    </div>
    
    <div style="${EMAIL_STYLES.content}">
      <div style="background: #fee2e2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
        <h2 style="margin: 0 0 10px 0; color: #dc2626;">${data.bugTitle}</h2>
        <p style="margin: 0; color: #991b1b;">${data.description}</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #dc2626;">⚠️ Impact Assessment</h3>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;"><strong>Project:</strong></td>
            <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #dee2e6;">${data.projectName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;"><strong>Environment:</strong></td>
            <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #dee2e6;">
              <span style="${EMAIL_STYLES.badge} background: #dc2626; color: white;">${data.environment}</span>
            </td>
          </tr>
          ${data.affectedUsers ? `
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;"><strong>Affected Users:</strong></td>
            <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #dee2e6; color: #dc2626; font-weight: bold;">
              ~${data.affectedUsers}
            </td>
          </tr>
          ` : ''}
          ${data.errorRate ? `
          <tr>
            <td style="padding: 10px 0;"><strong>Error Rate:</strong></td>
            <td style="padding: 10px 0; text-align: right; color: #dc2626; font-weight: bold;">
              ${data.errorRate}%
            </td>
          </tr>
          ` : ''}
        </table>
      </div>
      
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 25px 0; border-radius: 4px;">
        <h4 style="margin: 0 0 10px 0; color: #856404;">📋 Recommended Actions:</h4>
        <ol style="margin: 0; padding-left: 20px; color: #856404;">
          <li style="margin-bottom: 8px;">Investigate the bug immediately</li>
          <li style="margin-bottom: 8px;">Assess the scope of impact</li>
          <li style="margin-bottom: 8px;">Consider rolling back if necessary</li>
          <li>Communicate with stakeholders</li>
        </ol>
      </div>
      
      <center>
        <a href="${data.bugUrl}" style="${EMAIL_STYLES.button} background: #dc2626;">Investigate Now</a>
      </center>
      
      <p style="text-align: center; margin-top: 20px; color: #dc2626; font-weight: bold;">
        ⏰ This requires immediate attention
      </p>
    </div>
    
    <div style="${EMAIL_STYLES.footer}">
      <p style="margin: 0;">JestBest - AI-Powered QA Automation</p>
      <p style="margin: 5px 0 0 0; font-size: 12px; color: #dc2626;">
        This is a high-priority alert
      </p>
    </div>
  </div>
</body>
</html>
    `;
    
    await this.sendEmail({ to, subject, html });
  },
};
