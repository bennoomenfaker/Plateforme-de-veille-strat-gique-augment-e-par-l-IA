import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async generateProjectReport(projectId: string): Promise<string> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        objectives: {
          include: {
            axes: {
              include: {
                hypotheses: {
                  include: {
                    collection_plans: { include: { sources: true } },
                  },
                },
              },
            },
          },
          orderBy: { priority: 'asc' },
        },
        perimeters: true,
      },
    });

    if (!project) throw new NotFoundException('Projet introuvable');

    const enrichedItems = await this.prisma.enrichedItem.findMany({
      where: { project_id: projectId },
      orderBy: { relevance_score: 'desc' },
      take: 50,
    });

    const hypothesisEvals = await this.prisma.hypothesisEvaluation.findMany({
      where: { project_id: projectId },
    });

    const stats = {
      total_raw: await this.prisma.rawItem.count({ where: { project_id: projectId } }),
      total_processed: await this.prisma.processedItem.count({ where: { project_id: projectId } }),
      total_enriched: enrichedItems.length,
      avg_relevance: enrichedItems.length > 0
        ? enrichedItems.reduce((acc, i) => acc + (i.relevance_score ?? 0), 0) / enrichedItems.length
        : 0,
    };

    const IMPACT_LABELS: Record<string, string> = {
      OPEN: 'Ouverte', PARTIALLY_SUPPORTED: 'Partiellement supportée',
      SUPPORTED: 'Supportée', CONTRADICTED: 'Contredite', NEEDS_MORE_RESEARCH: 'À approfondir',
    };

    const IMPACT_COLORS: Record<string, string> = {
      OPEN: '#9ca3af', PARTIALLY_SUPPORTED: '#f59e0b',
      SUPPORTED: '#10b981', CONTRADICTED: '#ef4444', NEEDS_MORE_RESEARCH: '#8b5cf6',
    };

    const topInsights = enrichedItems.filter(i => i.answer).slice(0, 10);

    const objectivesHtml = (project.objectives ?? []).map(obj => {
      const axesHtml = (obj.axes ?? []).map(axe => {
        const hypothesesHtml = (axe.hypotheses ?? []).map(hyp => {
          const eval_ = hypothesisEvals.find(e => e.hypothesis_id === hyp.id);
          const impact = eval_?.status ?? 'OPEN';
          const color = IMPACT_COLORS[impact] ?? '#9ca3af';
          const label = IMPACT_LABELS[impact] ?? 'Ouverte';
          const conf = Math.round((eval_?.confidence ?? 0) * 100);
          const plans = hyp.collection_plans ?? [];
          const sources = plans.flatMap(p => p.sources ?? []).slice(0, 5);

          const answers = enrichedItems
            .filter(e => e.collection_plan_id && plans.map(p => p.id).includes(e.collection_plan_id ?? ''))
            .filter(e => e.answer)
            .slice(0, 3);

          return `
            <div style="margin-left:24px;margin-bottom:16px;padding:16px;background:#f8fafc;border-left:4px solid ${color};border-radius:4px;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                <span style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;">Hypothèse</span>
                <span style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:999px;background:${color}22;color:${color};">${label}</span>
                ${eval_ ? `<span style="font-size:11px;color:#64748b;">${conf}% confiance · ${eval_.evidence_count} preuves</span>` : ''}
              </div>
              <p style="font-size:14px;color:#1e293b;margin:0 0 12px 0;">${hyp.content}</p>
              ${sources.length > 0 ? `
                <div style="margin-bottom:8px;">
                  <p style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin:0 0 4px 0;">Sources clés</p>
                  ${sources.map(s => `<p style="font-size:12px;color:#3b82f6;margin:2px 0;">${s.source_label} ${s.source_url ? `<span style="color:#94a3b8;">(${s.source_url.slice(0,60)}...)</span>` : ''}</p>`).join('')}
                </div>
              ` : ''}
              ${answers.length > 0 ? `
                <div>
                  <p style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin:0 0 4px 0;">Réponses IA</p>
                  ${answers.map(a => `<p style="font-size:12px;color:#475569;margin:4px 0;font-style:italic;">"${(a.answer ?? '').slice(0, 200)}${(a.answer ?? '').length > 200 ? '...' : ''}"</p>`).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('');

        return `
          <div style="margin-left:16px;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;background:#ede9fe;color:#7c3aed;">Axe</span>
              <span style="font-size:14px;font-weight:600;color:#1e293b;">${axe.name}</span>
            </div>
            ${hypothesesHtml}
          </div>
        `;
      }).join('');

      return `
        <div style="margin-bottom:24px;padding:20px;background:white;border:1px solid #e2e8f0;border-radius:8px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #3b82f6;">
            <span style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:999px;background:#dbeafe;color:#1d4ed8;">Objectif ${obj.priority}</span>
            <span style="font-size:15px;font-weight:700;color:#0f172a;">${obj.content}</span>
          </div>
          ${axesHtml}
        </div>
      `;
    }).join('');

    const insightsHtml = topInsights.map((item, i) => {
      const pct = Math.round((item.relevance_score ?? 0) * 100);
      const impact = item.hypothesis_impact ?? 'OPEN';
      const color = IMPACT_COLORS[impact] ?? '#9ca3af';
      return `
        <tr style="background:${i % 2 === 0 ? 'white' : '#f8fafc'};">
          <td style="padding:10px 12px;font-size:12px;color:#1e293b;border-bottom:1px solid #e2e8f0;">${item.summary?.slice(0, 80) ?? 'Sans résumé'}...</td>
          <td style="padding:10px 12px;font-size:12px;font-weight:700;color:${color};border-bottom:1px solid #e2e8f0;">${IMPACT_LABELS[impact]}</td>
          <td style="padding:10px 12px;font-size:12px;font-weight:700;color:#10b981;border-bottom:1px solid #e2e8f0;">${pct}%</td>
        </tr>
      `;
    }).join('');

    const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport de veille — ${project.nom}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color:#1e293b; background:white; font-size:14px; line-height:1.6; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body style="padding:40px;max-width:900px;margin:0 auto;">

  <!-- En-tête -->
  <div style="background:linear-gradient(135deg,#1d4ed8,#4f46e5);color:white;padding:32px;border-radius:12px;margin-bottom:32px;">
    <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;opacity:0.7;margin-bottom:8px;">Rapport de veille stratégique</p>
    <h1 style="font-size:28px;font-weight:800;margin-bottom:8px;">${project.nom}</h1>
    <p style="font-size:13px;opacity:0.8;">Généré le ${now}</p>
    <div style="display:flex;gap:24px;margin-top:20px;flex-wrap:wrap;">
      <div><p style="font-size:11px;opacity:0.6;text-transform:uppercase;">Items collectés</p><p style="font-size:22px;font-weight:700;">${stats.total_raw}</p></div>
      <div><p style="font-size:11px;opacity:0.6;text-transform:uppercase;">Traités</p><p style="font-size:22px;font-weight:700;">${stats.total_processed}</p></div>
      <div><p style="font-size:11px;opacity:0.6;text-transform:uppercase;">Insights IA</p><p style="font-size:22px;font-weight:700;">${stats.total_enriched}</p></div>
      <div><p style="font-size:11px;opacity:0.6;text-transform:uppercase;">Score moyen</p><p style="font-size:22px;font-weight:700;">${Math.round(stats.avg_relevance * 100)}%</p></div>
    </div>
  </div>

  <!-- Structure stratégique -->
  <div style="margin-bottom:32px;">
    <h2 style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">Structure stratégique</h2>
    ${objectivesHtml || '<p style="color:#94a3b8;font-style:italic;">Aucun objectif défini</p>'}
  </div>

  <!-- Top insights -->
  ${topInsights.length > 0 ? `
  <div style="margin-bottom:32px;">
    <h2 style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">Top insights IA</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Résumé</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Impact</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Score</th>
        </tr>
      </thead>
      <tbody>${insightsHtml}</tbody>
    </table>
  </div>
  ` : ''}

  <!-- Conclusion -->
  <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:32px;">
    <h2 style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:12px;">Conclusion</h2>
    <p style="color:#475569;line-height:1.8;">
      Ce rapport synthétise l'activité de veille du projet <strong>${project.nom}</strong>.
      Sur ${stats.total_raw} items collectés, ${stats.total_processed} ont été nettoyés et 
      ${stats.total_enriched} ont été enrichis par intelligence artificielle.
      Le score de pertinence moyen est de <strong>${Math.round(stats.avg_relevance * 100)}%</strong>.
      ${hypothesisEvals.filter(e => e.status === 'SUPPORTED').length > 0 ? `${hypothesisEvals.filter(e => e.status === 'SUPPORTED').length} hypothèse(s) ont été supportées par les données collectées.` : ''}
      ${hypothesisEvals.filter(e => e.status === 'CONTRADICTED').length > 0 ? `${hypothesisEvals.filter(e => e.status === 'CONTRADICTED').length} hypothèse(s) ont été contredites et nécessitent une révision.` : ''}
    </p>
  </div>

  <!-- Pied de page -->
  <div style="text-align:center;padding-top:20px;border-top:1px solid #e2e8f0;">
    <p style="font-size:11px;color:#94a3b8;">VeilleAI — Rapport généré automatiquement · ${now}</p>
  </div>

</body>
</html>`;
  }
}
