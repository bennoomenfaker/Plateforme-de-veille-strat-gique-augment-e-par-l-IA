import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrganisationsController } from './organisations.controller';
import { OrganisationsService } from './organisations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthMailModule } from '../auth-mail/auth-mail.module';

@Module({
  imports: [
    JwtModule.register({
      secret: 'SECRET_KEY_SUPER_FORTE',
      signOptions: { expiresIn: '1d' },
    }),
    AuthMailModule,
  ],
  controllers: [OrganisationsController],
  providers: [OrganisationsService, PrismaService],
})
export class OrganisationsModule {}
