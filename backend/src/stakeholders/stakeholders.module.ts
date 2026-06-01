import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StakeholdersController } from './stakeholders.controller';
import { StakeholdersService } from './stakeholders.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: 'SECRET_KEY_SUPER_FORTE',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [StakeholdersController],
  providers: [StakeholdersService, PrismaService],
  exports: [StakeholdersService],
})
export class StakeholdersModule {}
