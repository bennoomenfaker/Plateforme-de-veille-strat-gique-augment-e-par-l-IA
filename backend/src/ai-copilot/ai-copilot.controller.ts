import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { LlmProviderService } from '../ai-enrichment/llm-provider.service';
import { AiCopilotService } from './ai-copilot.service';

@Controller('ai-copilot')
export class AiCopilotController {
  constructor(
    private readonly service: AiCopilotService,
    private readonly llm: LlmProviderService,
  ) {}

  @Post('suggest')
  @UseGuards(JwtAuthGuard)
  async suggest(@Body() body: { prompt: string }) {
    const raw = await this.service.generate(body.prompt);
    const parsed = this.llm.parseJsonResponse(raw);
    return { suggestions: parsed || { options: [raw] } };
  }

  @Post('refine')
  @UseGuards(JwtAuthGuard)
  async refine(@Body() body: { hypotheses: string[]; questions: string[] }) {
    const systemPrompt = `Tu es un expert en intelligence économique et en veille stratégique.

Ta mission est de CORRIGER et AMÉLIORER les hypothèses et questions de recherche générées ou saisies par l'utilisateur.

🎯 OBJECTIF :
Transformer des hypothèses et questions parfois trop longues, trop vagues ou trop complexes en versions : claires, structurées, testables, adaptées à la veille stratégique, simples à comprendre.

⚠️ RÈGLES IMPORTANTES :
- Ne jamais supprimer l'idée de l'utilisateur
- Toujours conserver le sens initial
- Simplifier sans perdre la valeur analytique
- Éviter les phrases trop longues ou multi-idées
- Une hypothèse = une seule idée causale
- Une question = une seule problématique principale
- Ne pas ajouter d'explications
- Ne pas faire de texte narratif

🧠 CORRECTION DES HYPOTHÈSES :
Objectif : transformer une affirmation longue en hypothèse testable.
Règles :
- utiliser des formulations comme : Si ... alors ..., L'évolution de ... pourrait ..., Les acteurs ... pourraient ...
- éviter les certitudes absolues
- simplifier les relations complexes

🧠 CORRECTION DES QUESTIONS :
Objectif : transformer une question complexe en question simple et exploitable.
Règles :
- une seule idée par question
- privilégier : Quels sont ..., Comment ..., Dans quelle mesure ...
- éviter les questions multi-parties

📤 FORMAT DE SORTIE :
Retourner uniquement un JSON :
{
  "hypotheses_corrigees": [],
  "questions_corrigees": []
}

Ne pas ajouter de texte avant ou après le JSON.`;

    const userPrompt = `Corrige et améliore les hypothèses et questions suivantes :

HYPOTHÈSES À CORRIGER :
${body.hypotheses.map((h, i) => `${i + 1}. ${h}`).join('\n')}

QUESTIONS À CORRIGER :
${body.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Retourne uniquement le JSON demandé sans texte supplémentaire.`;

    const raw = await this.service.generate(`${systemPrompt}\n\n${userPrompt}`);
    const parsed = this.llm.parseJsonResponse(raw);
    return {
      hypotheses_corrigees: parsed?.hypotheses_corrigees || [],
      questions_corrigees: parsed?.questions_corrigees || [],
    };
  }

  @Post('project')
  @UseGuards(JwtAuthGuard)
  async project(@Body() body: { mode: string; description?: string; project?: any; instruction?: string }) {
    let systemPrompt = '';

    if (body.mode === 'generate') {
      systemPrompt = `Tu es un expert en intelligence économique, veille stratégique et structuration de projets SaaS.

Tu es intégré dans une application SaaS de veille.

Ton rôle est de créer un projet de veille complet à partir d'une description utilisateur.

🎯 GÉNÉRATION DE PROJET (depuis description)

Tu dois générer :
- nom de projet (court et stratégique)
- problématique
- objectif de veille
- axes de veille
- hypothèses
- questions de recherche

⚠️ RÈGLES DE GÉNÉRATION :
- Tout doit être cohérent avec le sujet
- Ne pas inventer des domaines hors contexte
- Utiliser des verbes d'action (Analyser, Identifier, Surveiller, Évaluer)
- Chaque élément doit être relié au même thème central
- Pas de texte inutile
- Format clair et exploitable SaaS

📤 FORMAT DE SORTIE OBLIGATOIRE :
Retourner uniquement JSON :
{
  "project_name": "",
  "problematique": "",
  "objectif": "",
  "axes": [],
  "hypotheses": [],
  "questions": []
}

Ne pas ajouter de texte avant ou après le JSON.`;
    } else if (body.mode === 'correct') {
      systemPrompt = `Tu es un expert en intelligence économique, veille stratégique et structuration de projets SaaS.

Tu es intégré dans une application SaaS de veille.

Ton rôle est de corriger et améliorer un projet de veille existant.

🎯 CORRECTION / MODIFICATION DE PROJET

### 1. DÉTECTION DE COHÉRENCE
Vérifier :
- problématique ↔ objectif ↔ axes ↔ hypothèses ↔ questions
- lien avec le sujet principal

Identifier :
- éléments hors sujet
- contradictions
- manque de lien logique

### 2. CORRECTION INTELLIGENTE
- ajuster les éléments incohérents
- simplifier les phrases trop longues
- aligner tous les éléments sur le même sujet
- conserver les idées utilisateur autant que possible

### 3. AMÉLIORATION OPTIONNELLE
Dans coherence_report.suggestions, proposer des améliorations.

🧠 RÈGLE DE COHÉRENCE GLOBALE :
Tout le projet doit répondre à une seule logique centrale.
Si un élément s'écarte du sujet : le corriger ou le reformuler.

📤 FORMAT DE SORTIE OBLIGATOIRE :
Retourner uniquement JSON :
{
  "project_name": "",
  "problematique": "",
  "objectif": "",
  "axes": [],
  "hypotheses": [],
  "questions": [],
  "coherence_report": {
    "is_coherent": true/false,
    "issues": [],
    "suggestions": []
  }
}

Ne pas ajouter de texte avant ou après le JSON.`;
    } else if (body.mode === 'chat') {
      systemPrompt = `Tu es un expert en intelligence économique, veille stratégique et structuration de projets SaaS.

Tu es intégré dans une application SaaS de veille.

🎯 MODE CHATBOT IA — modification en langage naturel

L'utilisateur va donner une instruction comme :
- "change l'objectif"
- "améliore la problématique"
- "rends les hypothèses plus simples"
- "ce n'est pas cohérent"

Tu dois :
- modifier uniquement la partie demandée
- garder le reste intact
- assurer la cohérence globale

🧠 RÈGLE DE COHÉRENCE GLOBALE :
Tout le projet doit répondre à une seule logique centrale.

📤 FORMAT DE SORTIE OBLIGATOIRE :
Retourner uniquement JSON :
{
  "project_name": "",
  "problematique": "",
  "objectif": "",
  "axes": [],
  "hypotheses": [],
  "questions": [],
  "coherence_report": {
    "is_coherent": true/false,
    "issues": [],
    "suggestions": []
  }
}

Ne pas ajouter de texte avant ou après le JSON.`;
    }

    const projectContext = body.project
      ? `PROJET ACTUEL :
Nom: ${body.project.nom || ''}
Description: ${body.project.description || ''}
Problématique: ${body.project.problematique || ''}
Type: ${body.project.monitoring_type || ''}

Objectifs: ${(body.project.objectives || []).map((o: any) => o.content).join(', ')}
Axes: ${(body.project.axes || []).map((a: any) => a.name).join(', ')}
Hypothèses: ${(body.project.hypotheses || []).map((h: any) => h.content).join(', ')}
Questions: ${(body.project.plans || []).map((p: any) => p.question).join(', ')}`
      : '';

    const userInstruction = body.instruction
      ? `\n\nInstruction utilisateur : ${body.instruction}`
      : '';

    const userPrompt = `${
      body.mode === 'generate'
        ? `Génère un projet de veille complet à partir de cette description :\n\n${body.description}`
        : `${body.mode === 'correct' ? 'Analyse et améliore ce projet de veille' : 'Applique cette modification au projet'} :\n\n${projectContext}${userInstruction}`
    }\n\nRetourne uniquement le JSON demandé sans texte supplémentaire.`;

    const raw = await this.service.generate(`${systemPrompt}\n\n${userPrompt}`);
    const parsed = this.llm.parseJsonResponse(raw);
    return parsed || { error: 'Réponse invalide du LLM' };
  }
}
