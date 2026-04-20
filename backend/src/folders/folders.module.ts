import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [JwtModule.register({ secret: 'SECRET_KEY_SUPER_FORTE', signOptions: { expiresIn: '1d' } })],
  controllers: [FoldersController],
  providers: [FoldersService, PrismaService],
  exports: [FoldersService],
})
export class FoldersModule {}
