import { Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';

interface PasswordResetEntry {
  code: string;
  expiresAt: number;
}

@Injectable()
export class PasswordResetStore {
  private readonly items = new Map<string, PasswordResetEntry>();
  private readonly ttlMs = 10 * 60 * 1000;

  issueCode(email: string): string {
    const code = String(randomInt(100000, 1000000));
    const key = this.normalizeEmail(email);
    const expiresAt = Date.now() + this.ttlMs;
    this.items.set(key, { code, expiresAt });
    return code;
  }

  consumeCode(email: string, code: string): 'ok' | 'expired' | 'mismatch' | 'missing' {
    const key = this.normalizeEmail(email);
    const entry = this.items.get(key);
    if (!entry) return 'missing';
    if (Date.now() > entry.expiresAt) {
      this.items.delete(key);
      return 'expired';
    }
    if (entry.code !== code) return 'mismatch';
    this.items.delete(key);
    return 'ok';
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
