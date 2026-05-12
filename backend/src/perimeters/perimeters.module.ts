import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PerimetersController } from './perimeters.controller';
import { PerimetersService } from './perimeters.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [JwtModule.register({ secret: 'SECRET_KEY_SUPER_FORTE', signOptions: { expiresIn: '1d' } })],
  controllers: [PerimetersController],
  providers: [PerimetersService, PrismaService],
  exports: [PerimetersService],
})
export class PerimetersModule {}
