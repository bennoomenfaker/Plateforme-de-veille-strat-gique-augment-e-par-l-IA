import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common'; // Importation nécessaire
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Activation de la validation globale (Point 7.1)
  app.useGlobalPipes(new ValidationPipe({
    // Supprime les champs envoyés qui ne sont pas dans le DTO (Sécurité)
    whitelist: true, 
    // Rejette la requête si des champs inconnus sont envoyés
    forbidNonWhitelisted: true, 
    // Transforme automatiquement les types (ex: string en number)
    transform: true, 
  }));

  // Gestion des ports via variable d'environnement ou 3000 par défaut
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}`);
}
bootstrap();
