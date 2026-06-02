import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgAccessService } from '../common/org-access.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private orgAccess: OrgAccessService,
  ) {}

  private async checkAccess(projectId: string, userId: string) {
    const { project } = await this.orgAccess.assertProjectRead(
      projectId,
      userId,
    );
    return project;
  }

  private async checkWriteAccess(projectId: string, userId: string) {
    const { project } = await this.orgAccess.assertProjectWrite(
      projectId,
      userId,
    );
    return project;
  }

  async createProject(data: any, userId: string) {
    if (data.end_date) {
      throw new BadRequestException(
        'La date de clôture ne peut pas être définie à la création.',
      );
    }

    // Si l'user appartient à une org, on lie le projet à cette org automatiquement
    const membership = await this.prisma.membreOrganisation.findFirst({
      where: { user_id: userId, statut: 'ACTIF' },
    });

    const project = await this.prisma.project.create({
      data: {
        nom: data.nom,
        description: data.description,
        monitoring_type: data.monitoring_type || 'TECHNOLOGICAL',
        keywords: data.keywords || [],
        frequency: data.frequency || 'DAILY',
        end_date: null,
        folder_id: data.folder_id || null,
        owner_user_id: userId,
        // Si membre d'une org, lier automatiquement à cette org
        organisation_id: membership ? membership.organisation_id : null,
      },
    });
    await this.logActivity(userId, 'CREATE_PROJECT', 'project', project.id);
    return project;
  }

  async createOrgProject(data: any, userId: string, organisationId: string) {
    const role = await this.orgAccess.getOrgMemberRole(organisationId, userId);
    if (!this.orgAccess.canWrite(role)) {
      throw new ForbiddenException(
        "Accès insuffisant pour créer un projet d'organisation",
      );
    }

    if (data.end_date) {
      throw new BadRequestException(
        'La date de clôture ne peut pas être définie à la création.',
      );
    }

    const project = await this.prisma.project.create({
      data: {
        nom: data.nom,
        description: data.description,
        monitoring_type: data.monitoring_type || 'TECHNOLOGICAL',
        keywords: data.keywords || [],
        frequency: data.frequency || 'DAILY',
        end_date: null,
        folder_id: data.folder_id || null,
        organisation_id: organisationId,
        owner_user_id: userId,
      },
    });
    await this.logActivity(userId, 'CREATE_PROJECT', 'project', project.id);
    return project;
  }

  async getMyProjects(userId: string) {
    const commonFilter = { is_deleted: false, isActive: true };

    // Récupérer toutes les orgs de l'utilisateur
    const memberships = await this.prisma.membreOrganisation.findMany({
      where: { user_id: userId, statut: 'ACTIF' },
      select: { organisation_id: true },
    });
    const orgIds = memberships.map((m) => m.organisation_id);

    // Projets individuels (owner ET pas lié à une org)
    const individualProjects = await this.prisma.project.findMany({
      where: { ...commonFilter, owner_user_id: userId, organisation_id: null },
      include: {
        folder: true,
        sources: true,
        objectives: {
          include: {
            axes: {
              include: {
                hypotheses: {
                  include: {
                    collection_plans: {
                      include: { sources: true, keywords: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Projets d'organisation : tous les projets des orgs dont l'user est membre
    const orgProjects =
      orgIds.length > 0
        ? await this.prisma.project.findMany({
            where: {
              ...commonFilter,
              organisation_id: { in: orgIds },
            },
            include: {
              folder: true,
              sources: true,
              organisation: { select: { nom: true } },
              objectives: {
                include: {
                  axes: {
                    include: {
                      hypotheses: {
                        include: {
                          collection_plans: {
                            include: { sources: true, keywords: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          })
        : [];

    const enrichProject = (project: any) => {
      const planSources =
        project.objectives?.flatMap(
          (obj: any) =>
            obj.axes?.flatMap(
              (axe: any) =>
                axe.hypotheses?.flatMap(
                  (hyp: any) =>
                    hyp.collection_plans?.flatMap(
                      (plan: any) => plan.sources || [],
                    ) || [],
                ) || [],
            ) || [],
        ) || [];
      return {
        ...project,
        _totalSources: (project.sources?.length || 0) + planSources.length,
        _planSources: planSources,
      };
    };

    return {
      individual: individualProjects.map(enrichProject),
      organisation: orgProjects.map(enrichProject),
    };
  }

  async getProject(id: string, userId: string) {
    await this.checkAccess(id, userId);
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        sources: true,
        folder: true,
        perimeters: true,
        organisation: { select: { nom: true } },
        objectives: {
          include: {
            axes: {
              include: {
                hypotheses: {
                  include: {
                    collection_plans: {
                      include: { sources: true, keywords: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { priority: 'asc' },
        },
        stakeholders: {
          include: { user: { select: { id: true, nom: true, email: true } } },
        },
      },
    });
  }

  async updateProject(id: string, userId: string, data: any) {
    const project = await this.checkWriteAccess(id, userId);

    if (data.end_date) {
      const newEndDate = new Date(data.end_date);
      if (newEndDate < project.start_date) {
        throw new BadRequestException(
          'La date de fin ne peut pas être antérieure à la date de début.',
        );
      }
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        nom: data.nom,
        description: data.description,
        monitoring_type: data.monitoring_type,
        keywords: data.keywords,
        frequency: data.frequency,
        end_date: data.end_date ? new Date(data.end_date) : undefined,
        folder_id: data.folder_id,
      },
    });
    await this.logActivity(userId, 'UPDATE_PROJECT', 'project', id);
    return updated;
  }

  async closeProject(id: string, userId: string) {
    await this.checkWriteAccess(id, userId);
    const closed = await this.prisma.project.update({
      where: { id },
      data: { isActive: false, end_date: new Date() },
    });
    await this.logActivity(userId, 'CLOSE_PROJECT', 'project', id);
    return closed;
  }

  async reopenProject(id: string, userId: string) {
    await this.checkWriteAccess(id, userId);
    const reopened = await this.prisma.project.update({
      where: { id },
      data: { isActive: true, end_date: null },
    });
    await this.logActivity(userId, 'REOPEN_PROJECT', 'project', id);
    return reopened;
  }

  async archiveProject(id: string, userId: string) {
    await this.checkWriteAccess(id, userId);
    const archived = await this.prisma.project.update({
      where: { id },
      data: { isActive: false },
    });
    await this.logActivity(userId, 'ARCHIVE_PROJECT', 'project', id);
    return { message: 'Projet archivé', project: archived };
  }

  async deleteProject(id: string, userId: string) {
    await this.checkWriteAccess(id, userId);
    await this.prisma.project.update({
      where: { id },
      data: { is_deleted: true, deleted_at: new Date() },
    });
    await this.logActivity(userId, 'DELETE_PROJECT', 'project', id);
    return { message: 'Projet supprimé avec succès' };
  }

  async getGraphData(userId: string) {
    const individualProjects = await this.prisma.project.findMany({
      where: {
        owner_user_id: userId,
        organisation_id: null,
        is_deleted: false,
        isActive: true,
      },
      include: {
        perimeters: true,
        objectives: {
          include: {
            axes: {
              include: {
                hypotheses: {
                  include: {
                    collection_plans: {
                      include: { sources: true, keywords: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { priority: 'asc' },
        },
      },
    });

    const memberships = await this.prisma.membreOrganisation.findMany({
      where: { user_id: userId, statut: 'ACTIF' },
      select: { organisation_id: true },
    });

    let orgProjects: any[] = [];
    if (memberships.length) {
      orgProjects = await this.prisma.project.findMany({
        where: {
          organisation_id: { in: memberships.map((m) => m.organisation_id) },
          is_deleted: false,
          isActive: true,
        },
        include: {
          perimeters: true,
          objectives: {
            include: {
              axes: {
                include: {
                  hypotheses: {
                    include: {
                      collection_plans: {
                        include: { sources: true, keywords: true },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { priority: 'asc' },
          },
        },
      });
    }

    return [...individualProjects, ...orgProjects];
  }

  async getArchivedProjects(userId: string) {
    return this.prisma.project.findMany({
      where: { owner_user_id: userId, isActive: false, is_deleted: false },
    });
  }

  async duplicateProject(id: string, userId: string) {
    await this.checkAccess(id, userId);
    const source = await this.prisma.project.findUnique({
      where: { id },
      include: {
        perimeters: true,
        objectives: {
          include: {
            axes: {
              include: {
                hypotheses: {
                  include: {
                    collection_plans: {
                      include: { sources: true, keywords: true },
                    },
                    hypothesis_perimeters: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!source) throw new NotFoundException('Projet introuvable');

    return this.prisma.$transaction(async (tx) => {
      const objMap = new Map<string, string>();
      const permMap = new Map<string, string>();

      const newProject = await tx.project.create({
        data: {
          nom: `Copie de ${source.nom}`,
          description: source.description,
          monitoring_type: source.monitoring_type,
          keywords: source.keywords,
          owner_user_id: userId,
          organisation_id: source.organisation_id,
          folder_id: source.folder_id,
        },
      });

      for (const p of source.perimeters) {
        const np = await tx.projectPerimeter.create({
          data: { name: p.name, type: p.type, value: p.value, project_id: newProject.id },
        });
        permMap.set(p.id, np.id);
      }

      for (const obj of source.objectives) {
        const newObj = await tx.projectObjective.create({
          data: { content: obj.content, priority: obj.priority, project_id: newProject.id },
        });
        objMap.set(obj.id, newObj.id);

        for (const axe of obj.axes) {
          const newAxe = await tx.projectAxis.create({
            data: { name: axe.name, description: axe.description, priority: axe.priority, objective_id: newObj.id },
          });

          for (const hyp of axe.hypotheses) {
            const newHyp = await tx.projectHypothesis.create({
              data: { content: hyp.content, priority: hyp.priority, statut: hyp.statut, axis_id: newAxe.id },
            });

            for (const plan of hyp.collection_plans || []) {
              await tx.collectionPlan.create({
                data: {
                  question: plan.question,
                  frequency: plan.frequency,
                  hypothesis_id: newHyp.id,
                  sources: {
                    create: (plan.sources || []).map((s: any) => ({
                      source_type: s.source_type,
                      source_label: s.source_label,
                      source_url: s.source_url,
                      frequency: s.frequency,
                      metadata: s.metadata,
                    })),
                  },
                  keywords: {
                    create: (plan.keywords || []).map((k: any) => ({
                      keyword: k.keyword,
                      keyword_type: k.keyword_type,
                    })),
                  },
                },
              });
            }

            for (const hp of hyp.hypothesis_perimeters || []) {
              const newPermId = permMap.get(hp.perimeter_id);
              if (newPermId) {
                await tx.hypothesisPerimeter.create({
                  data: { hypothesis_id: newHyp.id, perimeter_id: newPermId },
                });
              }
            }
          }
        }
      }

      return newProject;
    });
  }

  async exportCsv(projectId: string, userId: string): Promise<string> {
    await this.checkAccess(projectId, userId);
    const items = await this.prisma.enrichedItem.findMany({
      where: { project_id: projectId },
      orderBy: { enriched_at: 'desc' },
    });

    const header = 'title,summary,sentiment,relevance,confidence,hypothesis_impact,model_used,enriched_at\n';
    const rows = items.map((item) => {
      const title = (item.summary || '').replace(/"/g, '""').slice(0, 100);
      const summary = (item.summary || '').replace(/"/g, '""').slice(0, 200);
      return `"${title}","${summary}",${item.sentiment},${item.relevance_score ?? ''},${item.confidence_score ?? ''},${item.hypothesis_impact || ''},${item.model_used || ''},${item.enriched_at?.toISOString() || ''}`;
    });

    return header + rows.join('\n');
  }

  private async logActivity(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
  ) {
    try {
      await this.prisma.userActivityLog.create({
        data: { user_id: userId, action, entityType, entityId },
      });
    } catch {}
  }
}
