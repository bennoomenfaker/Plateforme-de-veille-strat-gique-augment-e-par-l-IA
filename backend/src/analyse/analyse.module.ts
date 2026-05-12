import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AnalyseController } from './analyse.controller';
import { AnalyseService } from './analyse.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: 'SECRET_KEY_SUPER_FORTE',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AnalyseController],
  providers: [AnalyseService, PrismaService],
  exports: [AnalyseService],
})
export class AnalyseModule {}
