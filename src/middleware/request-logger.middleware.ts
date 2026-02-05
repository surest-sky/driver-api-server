import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RequestLogger');
  private readonly logDir = path.join(
    process.env.LOG_DIR || process.env.TMPDIR || '/tmp',
    'logs',
  );

  constructor() {
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const { method, originalUrl, ip, headers } = req;

    // Get user agent and real IP
    const userAgent = headers['user-agent'] || 'Unknown';
    const realIp = headers['x-forwarded-for'] || headers['x-real-ip'] || ip;

    // Console log
    this.logger.log(`${method} ${originalUrl} - IP: ${realIp}`);

    // Listen for response finish event
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      // Create request log object (req.body should be parsed when response finishes)
      const requestLog = {
        timestamp,
        method,
        url: originalUrl,
        ip: realIp,
        userAgent,
        headers: this.filterSensitiveHeaders(headers),
        body: this.filterSensitiveData(req.body),
        query: req.query,
        statusCode,
        duration: `${duration}ms`,
        responseTime: duration,
      };

      // Console log response
      this.logger.log(
        `${method} ${originalUrl} - ${statusCode} - ${duration}ms - IP: ${realIp}`
      );

      // Write to file log
      this.writeToFile(requestLog);
    });

    next();
  }

  private filterSensitiveHeaders(headers: any): any {
    const filtered = { ...headers };
    // Filter sensitive information
    if (filtered.authorization) {
      filtered.authorization = '[FILTERED]';
    }
    if (filtered.cookie) {
      filtered.cookie = '[FILTERED]';
    }
    return filtered;
  }

  private filterSensitiveData(data: any): any {
    if (!data) return data;
    
    const filtered = { ...data };
    // Filter sensitive fields
    if (filtered.password) {
      filtered.password = '[FILTERED]';
    }
    if (filtered.token) {
      filtered.token = '[FILTERED]';
    }
    return filtered;
  }

  private writeToFile(logData: any): void {
    try {
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const logFileName = `requests-${date}.log`;
      const logFilePath = path.join(this.logDir, logFileName);
      
      const logEntry = JSON.stringify(logData) + '\n';
      
      fs.appendFileSync(logFilePath, logEntry, 'utf8');
    } catch (error) {
      this.logger.error('Failed to write log to file:', error);
    }
  }
}
