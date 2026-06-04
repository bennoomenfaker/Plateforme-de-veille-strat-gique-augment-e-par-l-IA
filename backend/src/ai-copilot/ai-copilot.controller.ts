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
    try {
      const raw = await this.service.generate(body.prompt);
      const parsed = this.llm.parseJsonResponse(raw);
      return { suggestions: parsed || { options: [raw] } };
    } catch (e) {
      return { error: 'Service IA momentanément indisponible', suggestions: { options: [] } };
    }
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

    let raw: string;
    try {
      raw = await this.service.generate(`${systemPrompt}\n\n${userPrompt}`);
    } catch {
      return { hypotheses_corrigees: [], questions_corrigees: [] };
    }
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
  "objectives": [],
  "axes": [],
  "hypotheses": [],
  "questions": []
}

Ne pas ajouter de texte avant ou après le JSON.`;
    } else if (body.mode === 'correct') {
      systemPrompt = `Tu es un expert en veille stratégique. Détecte UNIQUEMENT les problèmes GRAVES dans ce projet.

RÈGLES STRICTES — dans l'ordre de priorité :

1. MOTS ABSURDES : détecte les valeurs sans sens (lettre seule comme "i", "hh", mots aléatoires, caractères seuls) → type="remove"
2. HORS SUJET : éléments sans rapport avec le projet → type="remove"
3. DOUBLONS : éléments identiques ou très similaires → type="remove"
4. AMÉLIORATIONS MINEURES : NE PAS signaler les éléments bien formulés et cohérents. Signale UNIQUEMENT si l'élément est vraiment mal formulé ou trop vague → type="replace"

SI un élément est pertinent, cohérent et bien formulé → NE PAS le corriger.
SI un élément est absurde (lettre seule, mot vide) → type="remove".

Pour chaque problème :
- type: "remove" ou "replace"
- element: "objectif", "axe", "hypothese", "question"
- index: numéro dans la liste (1-based)
- original: valeur originale
- raison: explication courte
- correction: suggestion

Réponds UNIQUEMENT avec ce JSON, sans texte avant ni après :

{
  "problematique": "",
  "objectif": "",
  "objectives": [],
  "axes": [],
  "hypotheses": [],
  "questions": [],
  "coherence_report": {
    "nb_problemes": 0,
    "corrections": [
      {
        "type": "remove",
        "element": "objectif",
        "index": 1,
        "original": "fakerben",
        "raison": "Mot sans rapport avec le projet",
        "correction": "Supprimer cet objectif"
      }
    ],
    "suggestions": []
  }
}

Les listes objectives, axes, hypotheses, questions doivent contenir les VERSIONS CORRIGÉES (sans les éléments supprimés).
Ne laisse JAMAIS les listes vides si le projet original avait des éléments valides.
Si tout est cohérent, coherence_report.nb_problemes = 0 et corrections = [].`;
    } else if (body.mode === 'chat') {
      systemPrompt = `Tu es un expert en veille stratégique. Modifie le projet selon l'instruction.

Règles :
- ne modifie QUE la partie demandée, garde le reste intact
- assure la cohérence globale du projet
- réponds UNIQUEMENT avec ce JSON :

{
  "problematique": "",
  "objectif": "",
  "objectives": [],
  "axes": [],
  "hypotheses": [],
  "questions": [],
  "coherence_report": {
    "nb_problemes": 0,
    "corrections": [],
    "suggestions": []
  }
}

Tous les champs doivent être remplis (valeurs originales ou modifiées).
Ne laisse JAMAIS de listes vides si le projet avait des éléments.`;
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

    try {
      const raw = await this.service.generate(`${systemPrompt}\n\n${userPrompt}`);
      const parsed = this.llm.parseJsonResponse(raw);
      if (parsed) return parsed;
      return {
        error: 'Réponse invalide du LLM',
        raw: raw.substring(0, 2000),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        error: `Service IA momentanément indisponible. Veuillez réessayer dans quelques instants.`,
        details: msg,
        raw: '',
      };
    }
  }
}
