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
}
