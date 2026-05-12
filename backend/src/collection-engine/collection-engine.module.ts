import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CollectionController } from './collection.controller';
import { CollectionManager } from './collection.manager';
import { RssService } from './connectors/rss.service';
import { KeywordFilter } from './filters/keyword.filter';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'SECRET_KEY_SUPER_FORTE',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [CollectionController],
  providers: [CollectionManager, RssService, KeywordFilter, PrismaService],
  exports: [CollectionManager],
})
export class CollectionEngineModule {}
