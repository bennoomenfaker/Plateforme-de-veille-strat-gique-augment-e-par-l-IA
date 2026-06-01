import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';

const avatarDir =
  process.env.UPLOAD_AVATAR_DIR || join(process.cwd(), 'uploads', 'avatars');
if (!existsSync(avatarDir)) {
  mkdirSync(avatarDir, { recursive: true });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('register/organisation')
  async registerOrganisation(@Body() body: any) {
    return this.authService.registerOrganisation(body);
  }

  @Post('register/invitation')
  async validateInvitation(@Body() body: any) {
    return this.authService.validateInvitation(body.token, body);
  }

  @Post('login')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  async login(@Body() body: any) {
    return this.authService.login(body);
  }

  @Post('admin/login')
  async loginSuperAdmin(@Body() body: { email: string; password: string }) {
    return this.authService.loginSuperAdmin(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.userId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req: any, @Body() body: { nom?: string }) {
    return this.authService.updateProfile(req.user.userId, body);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(req.user.userId, body);
  }

  @Post('profile/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: avatarDir,
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new Error('Seules les images sont acceptées'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(@Request() req: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('Fichier requis');
    const photo_url = `/uploads/avatars/${file.filename}`;
    return this.authService.updateProfile(req.user.userId, { photo_url });
  }

  @Post('refresh')
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refreshToken(body.refresh_token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Body() body: { refresh_token: string }, @Request() req: any) {
    return this.authService.logout(body.refresh_token, req.user.userId);
  }

  @Post('forgot-password')
  @Throttle({ auth: { limit: 3, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('reset-password')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  async resetPassword(@Body() body: { token: string; new_password: string }) {
    return this.authService.resetPassword(body.token, body.new_password);
  }
}
