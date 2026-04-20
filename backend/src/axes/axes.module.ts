import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AxesController } from './axes.controller';
import { AxesService } from './axes.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [JwtModule.register({ secret: 'SECRET_KEY_SUPER_FORTE', signOptions: { expiresIn: '1d' } })],
  controllers: [AxesController],
  providers: [AxesService, PrismaService],
  exports: [AxesService],
})
export class AxesModule {}
