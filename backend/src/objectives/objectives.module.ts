import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ObjectivesController } from './objectives.controller';
import { ObjectivesService } from './objectives.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [JwtModule.register({ secret: 'SECRET_KEY_SUPER_FORTE', signOptions: { expiresIn: '1d' } })],
  controllers: [ObjectivesController],
  providers: [ObjectivesService, PrismaService],
  exports: [ObjectivesService],
})
export class ObjectivesModule {}
