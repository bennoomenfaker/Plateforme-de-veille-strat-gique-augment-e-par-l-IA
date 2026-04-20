import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: 'SECRET_KEY_SUPER_FORTE',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [SourcesController],
  providers: [SourcesService, PrismaService],
})
export class SourcesModule {}
