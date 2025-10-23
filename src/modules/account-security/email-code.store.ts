import { Injectable, Logger } from '@nestjs/common';

type CodeEntry = {
  code: string;
  expiresAt: number;
};

@Injectable()
export class EmailCodeStore {
  private readonly logger = new Logger(EmailCodeStore.name);
  private readonly store = new Map<string, CodeEntry>();

  set(userId: number, email: string, code: string, ttlMs: number): void {
    const key = this.key(userId, email);
    this.store.set(key, {
      code,
      expiresAt: Date.now() + ttlMs,
    });
  }

  verify(userId: number, email: string, code: string): boolean {
    const key = this.key(userId, email);
    const entry = this.store.get(key);
    if (!entry) {
      return false;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    const matched = entry.code.trim() == code.trim();
    if (matched) {
      this.store.delete(key);
    }
    return matched;
  }

  cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  private key(userId: number, email: string): string {
    return `${userId}:${email.trim().toLowerCase()}`;
  }
}
