import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface HypothesisInsight {
  hypothesisId: string;
  hypothesisContent: string;
  objective: string;
  axis: string;
  status: string;
  confidence: number;
  evidenceCount: number;
  supportCount: number;
  againstCount: number;
  neutralCount: number;
  newEvidence: number;
  insight: string | null;
}

@Injectable()
export class HypothesisInsightService {
  private readonly logger = new Logger(HypothesisInsightService.name);
  constructor(private prisma: PrismaService) {}

  async analyzeHypotheses(projectId: string): Promise<HypothesisInsight[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        objectives: {
          include: {
            axes: {
              include: { hypotheses: true },
            },
          },
        },
      },
    });
    if (!project) return [];

    const hypothesisIds = project.objectives.flatMap(o =>
      o.axes.flatMap(a => a.hypotheses.map(h => h.id)),
    );

    const evals = await this.prisma.hypothesisEvaluation.findMany({
      where: { hypothesis_id: { in: hypothesisIds } },
    });
    const evalMap = new Map(evals.map(e => [e.hypothesis_id, e]));

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentEnriched = await this.prisma.enrichedItem.findMany({
      where: {
        project_id: projectId,
        hypothesis_id: { in: hypothesisIds },
        enriched_at: { gte: sevenDaysAgo },
      },
    });
    const recentByHypothesis = new Map<string, typeof recentEnriched>();
    for (const item of recentEnriched) {
      if (!item.hypothesis_id) continue;
      if (!recentByHypothesis.has(item.hypothesis_id)) {
        recentByHypothesis.set(item.hypothesis_id, []);
      }
      recentByHypothesis.get(item.hypothesis_id)!.push(item);
    }

    const results: HypothesisInsight[] = [];

    for (const obj of project.objectives) {
      for (const ax of obj.axes) {
        for (const hyp of ax.hypotheses) {
          const ev = evalMap.get(hyp.id);
          const recent = recentByHypothesis.get(hyp.id) || [];
          const supportRecent = recent.filter(r => r.hypothesis_impact === 'SUPPORTED').length;
          const againstRecent = recent.filter(r => r.hypothesis_impact === 'CONTRADICTED').length;

          let insight: string | null = null;
          if (ev) {
            if (supportRecent > againstRecent && supportRecent > 0) {
              insight = `Les nouvelles données renforcent l'hypothèse « ${hyp.content} » (${supportRecent} article(s) supplémentaire(s) récent(s) confirment)`;
            } else if (againstRecent > supportRecent && againstRecent > 0) {
              insight = `De nouvelles données contredisent l'hypothèse « ${hyp.content} » (${againstRecent} article(s) contradictoire(s) récent(s))`;
            } else if (ev.support_count > ev.against_count * 2 && ev.evidence_count > 5) {
              insight = `L'hypothèse « ${hyp.content} » est solidement étayée avec ${ev.evidence_count} preuves (confiance: ${Math.round((ev.confidence || 0) * 100)}%).`;
            }
          }

          results.push({
            hypothesisId: hyp.id,
            hypothesisContent: hyp.content,
            objective: obj.content,
            axis: ax.name,
            status: ev?.status || 'OPEN',
            confidence: ev?.confidence || 0,
            evidenceCount: ev?.evidence_count || 0,
            supportCount: ev?.support_count || 0,
            againstCount: ev?.against_count || 0,
            neutralCount: ev?.neutral_count || 0,
            newEvidence: recent.length,
            insight,
          });
        }
      }
    }

    return results;
  }
}
