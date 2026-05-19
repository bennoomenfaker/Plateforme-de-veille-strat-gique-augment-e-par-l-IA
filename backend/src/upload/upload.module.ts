import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: '/app/uploads/pdfs',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new Error('Seuls les fichiers PDF sont acceptés'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService, PrismaService],
})
export class UploadModule {}
