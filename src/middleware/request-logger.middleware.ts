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
    // 确保日志目录存在
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const { method, originalUrl, ip, headers } = req;
    
    // 获取用户代理和真实IP
    const userAgent = headers['user-agent'] || 'Unknown';
    const realIp = headers['x-forwarded-for'] || headers['x-real-ip'] || ip;

    // 控制台日志
    this.logger.log(`${method} ${originalUrl} - IP: ${realIp}`);

    // 监听响应结束事件
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      // 创建请求日志对象（在响应结束时，req.body应该已经被解析）
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

      // 控制台日志响应
      this.logger.log(
        `${method} ${originalUrl} - ${statusCode} - ${duration}ms - IP: ${realIp}`
      );

      // 写入文件日志
      this.writeToFile(requestLog);
    });

    next();
  }

  private filterSensitiveHeaders(headers: any): any {
    const filtered = { ...headers };
    // 过滤敏感信息
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
    // 过滤敏感字段
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
