import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AppointmentAutoCompleteService } from '../modules/appointments/appointment-auto-complete.service';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const maintenance = appContext.get(AppointmentAutoCompleteService);
    const result = await maintenance.runMaintenance();
    console.log(
      `Appointment maintenance completed. Completed: ${result.completed}, Cancelled: ${result.cancelled}`,
    );
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error('Appointment maintenance failed:', error);
    process.exitCode = 1;
  } finally {
    await appContext.close();
  }
}

void bootstrap();
