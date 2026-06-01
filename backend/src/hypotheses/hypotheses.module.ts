import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HypothesesController } from './hypotheses.controller';
import { HypothesesService } from './hypotheses.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: 'SECRET_KEY_SUPER_FORTE',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [HypothesesController],
  providers: [HypothesesService, PrismaService],
  exports: [HypothesesService],
})
export class HypothesesModule {}
