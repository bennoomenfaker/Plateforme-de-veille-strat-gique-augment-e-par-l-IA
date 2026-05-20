import { Global, Module } from '@nestjs/common';
import { OrgAccessService } from './org-access.service';
import { PrismaService } from '../prisma/prisma.service';

@Global()
@Module({
  providers: [OrgAccessService, PrismaService],
  exports: [OrgAccessService],
})
export class CommonModule {}
