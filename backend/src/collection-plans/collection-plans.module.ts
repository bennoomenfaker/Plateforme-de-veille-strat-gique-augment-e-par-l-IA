import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CollectionPlansController } from './collection-plans.controller';
import { CollectionPlansService } from './collection-plans.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [JwtModule.register({ secret: 'SECRET_KEY_SUPER_FORTE', signOptions: { expiresIn: '1d' } })],
  controllers: [CollectionPlansController],
  providers: [CollectionPlansService, PrismaService],
  exports: [CollectionPlansService],
})
export class CollectionPlansModule {}
