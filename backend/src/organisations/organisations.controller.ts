import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { OrganisationsService } from './organisations.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('organisations')
@UseGuards(JwtAuthGuard)
export class OrganisationsController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  // POST /organisations → créer organisation
  @Post()
  async create(@Body() body: any, @Request() req: any) {
    return this.organisationsService.createOrganisation(req.user.userId, body);
  }

  // GET /organisations/me → mon organisation
  @Get('me')
  async getMyOrganisation(@Request() req: any) {
    return this.organisationsService.getMyOrganisation(req.user.userId);
  }

  // GET /organisations/:id → détail organisation
  @Get(':id')
  async getOrganisation(@Param('id') id: string, @Request() req: any) {
    return this.organisationsService.getOrganisation(id, req.user.userId);
  }

  // GET /organisations/:id/membres → liste membres
  @Get(':id/membres')
  async getMembers(@Param('id') id: string, @Request() req: any) {
    return this.organisationsService.getMembers(id, req.user.userId);
  }

  // POST /organisations/:id/membres → ajouter membre directement
  @Post(':id/membres')
  async addMember(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.organisationsService.addMember(id, req.user.userId, body);
  }

  // POST /organisations/:id/invite → inviter via email
  @Post(':id/invite')
  async invite(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.organisationsService.inviteMember(id, req.user.userId, body);
  }

  // DELETE /organisations/:id/membres/:memberId → révoquer
  @Delete(':id/membres/:memberId')
  async revoke(@Param('id') id: string, @Param('memberId') memberId: string, @Request() req: any) {
    return this.organisationsService.revokeMember(id, req.user.userId, memberId);
  }

  // PATCH /organisations/:id/membres/:memberId/role → changer rôle
  @Patch(':id/membres/:memberId/role')
  async changeRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: { role: string },
    @Request() req: any,
  ) {
    return this.organisationsService.changeMemberRole(id, req.user.userId, memberId, body.role);
  }

  // PATCH /organisations/:id/membres/:memberId/status → changer statut
  @Patch(':id/membres/:memberId/status')
  async changeStatus(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: { statut: string },
    @Request() req: any,
  ) {
    return this.organisationsService.changeMemberStatus(id, req.user.userId, memberId, body.statut);
  }

  // GET /organisations/:id/invitations → historique
  @Get(':id/invitations')
  async getInvitations(@Param('id') id: string, @Request() req: any) {
    return this.organisationsService.getInvitationsHistory(id, req.user.userId);
  }
}
