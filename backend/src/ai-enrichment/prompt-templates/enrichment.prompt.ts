export function buildEnrichmentPrompt(data: {
  question: string;
  hypothesis: string;
  perimeters: string[];
  content: string;
  title: string;
}): string {
  return `Tu es un assistant d'analyse de veille stratégique. Analyse cet article et réponds en JSON strict.

CONTEXTE:
- Question de recherche: "${data.question}"
- Hypothèse à évaluer: "${data.hypothesis}"
- Périmètres: ${data.perimeters.join(', ')}

ARTICLE:
Titre: ${data.title}
Contenu: ${data.content.substring(0, 3000)}

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans explication):
{
  "answer": "réponse directe à la question de recherche en 2-3 phrases",
  "summary": "résumé objectif de l'article en 3-4 phrases",
  "entities": ["entité1", "entité2", "entité3"],
  "topics": ["sujet1", "sujet2"],
  "sentiment": "POSITIF" ou "NEGATIF" ou "NEUTRE",
  "relevance_score": 0.0 à 1.0,
  "hypothesis_impact": "OPEN" ou "PARTIALLY_SUPPORTED" ou "SUPPORTED" ou "CONTRADICTED" ou "NEEDS_MORE_RESEARCH",
  "confidence_score": 0.0 à 1.0
}`;
}
