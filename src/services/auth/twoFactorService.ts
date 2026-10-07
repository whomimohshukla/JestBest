import { authenticator } from 'otplib';
import QRCode from 'qrcode';

const ISSUER = 'JestBest';

export const twoFactorService = {
  generateSecret(): string {
    return authenticator.generateSecret();
  },

  generateOtpauthUrl(secret: string, accountName: string): string {
    return authenticator.keyuri(accountName, ISSUER, secret);
  },

  async generateQrDataUrl(secret: string, accountName: string): Promise<string> {
    return QRCode.toDataURL(this.generateOtpauthUrl(secret, accountName));
  },

  verify(secret: string | null | undefined, code: string): boolean {
    if (!secret || !/^\d{6}$/.test(code)) {
      return false;
    }
    try {
      return authenticator.check(code, secret);
    } catch {
      return false;
    }
  },
};
