import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SocketIOAdapter } from './socket-io.adapter';
import { join } from 'path';
import * as fs from 'fs';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as hbs from 'hbs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configure hbs template engine
  app.engine('hbs', hbs.__express);
  app.setViewEngine('hbs');
  app.setBaseViewsDir(join(__dirname, '..', 'views'));

  // Enable custom Socket.IO adapter
  app.useWebSocketAdapter(new SocketIOAdapter(app));

  // Enable CORS
  app.enableCors();

  // Disable global ValidationPipe as it incorrectly validates query parameters
  // app.useGlobalPipes(new ValidationPipe({
  //   whitelist: true,
  //   transform: true,
  //   transformOptions: {
  //     enableImplicitConversion: true,
  //   },
  // }));
  
  // Register request logger middleware (after JSON parsing)
  app.use(new RequestLoggerMiddleware().use.bind(new RequestLoggerMiddleware()));
  app.setGlobalPrefix('api');
  // Static assets (local files)
  const dir = process.env.UPLOAD_TMP_DIR || process.env.TMPDIR || '/tmp';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Serve static files via /static prefix
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  app.use('/static', express.static(dir, { maxAge: '7d' }));
  // Serve public folder for images
  app.use(express.static(join(__dirname, '..', 'public')));
  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Driver App API')
    .setDescription('NestJS API for Driver App with JWT')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Setup page routes (outside /api prefix)
  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance();

  // Home page
  instance.get('/', (req: any, res: any) => {
    res.render('index');
  });

  // Support page
  instance.get('/support', (req: any, res: any) => {
    res.render('support');
  });

  // Privacy page
  instance.get('/privacy', (req: any, res: any) => {
    res.render('privacy');
  });

  // Download page
  instance.get('/download', (req: any, res: any) => {
    res.render('download');
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3007;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://${host}:${port}/api`);
  // eslint-disable-next-line no-console
  console.log(`Socket.IO server running on http://${host}:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Website available at http://${host}:${port}`);
}
bootstrap();
