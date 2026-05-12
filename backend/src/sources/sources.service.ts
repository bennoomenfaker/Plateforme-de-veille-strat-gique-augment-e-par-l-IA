import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SourcesService {
  constructor(private prisma: PrismaService) {}

  async createSource(data: any) {
    return this.prisma.source.create({
      data: {
        name: data.name,
        url: data.url,
        projectId: data.projectId,
      },
    });
  }

  async getSourcesByProject(projectId: string) {
    return this.prisma.source.findMany({
      where: { projectId },
    });
  }

  async deleteSource(id: string) {
    return this.prisma.source.delete({ where: { id } });
  }
}
