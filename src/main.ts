import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SocketIOAdapter } from './socket-io.adapter';
import { join } from 'path';
import * as fs from 'fs';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 启用自定义Socket.IO适配器
  app.useWebSocketAdapter(new SocketIOAdapter(app));
  
  // 启用CORS
  app.enableCors();
  
  // 禁用全局 ValidationPipe，因为它会错误地验证 query 参数
  // app.useGlobalPipes(new ValidationPipe({
  //   whitelist: true,
  //   transform: true,
  //   transformOptions: {
  //     enableImplicitConversion: true,
  //   },
  // }));
  
  // 注册请求日志中间件（在JSON解析之后）
  app.use(new RequestLoggerMiddleware().use.bind(new RequestLoggerMiddleware()));
  app.setGlobalPrefix('api');
  // 静态资源（本地文件）
  const dir = join(process.cwd(), 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // 通过 /static 前缀对外提供静态访问
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  app.use('/static', express.static(dir, { maxAge: '7d' }));
  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Driver App API')
    .setDescription('NestJS API for Driver App with JWT')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  const port = process.env.PORT ? Number(process.env.PORT) : 3007;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://${host}:${port}/api`);
  // eslint-disable-next-line no-console
  console.log(`Socket.IO server running on http://${host}:${port}`);
}
bootstrap();
