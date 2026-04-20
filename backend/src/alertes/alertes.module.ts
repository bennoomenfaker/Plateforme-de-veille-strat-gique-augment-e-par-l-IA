import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AlertesController } from './alertes.controller';
import { AlertesService } from './alertes.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: 'SECRET_KEY_SUPER_FORTE',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AlertesController],
  providers: [AlertesService, PrismaService],
  exports: [AlertesService],
})
export class AlertesModule {}
