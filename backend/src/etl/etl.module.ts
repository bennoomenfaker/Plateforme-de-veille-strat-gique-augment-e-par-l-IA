import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EtlService } from './etl.service';
import { EtlController } from './etl.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: 'SECRET_KEY_SUPER_FORTE',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [EtlService, PrismaService],
  controllers: [EtlController],
  exports: [EtlService],
})
export class EtlModule {}
