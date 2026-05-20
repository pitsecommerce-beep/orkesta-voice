import Anthropic from '@anthropic-ai/sdk';
import { TranscriptEntry } from '@orkesta/shared';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ConversationContext {
  systemPrompt: string;
  history: TranscriptEntry[];
  ragContext?: string;
  prospectName?: string;
  prospectCompany?: string;
}

export async function generateAgentResponse(
  userMessage: string,
  context: ConversationContext
): Promise<string> {
  const messages: Anthropic.MessageParam[] = context.history.map((entry) => ({
    role: entry.role === 'agent' ? 'assistant' : 'user',
    content: entry.content,
  }));

  // Add current user message
  messages.push({ role: 'user', content: userMessage });

  // Enhance system prompt with RAG context and prospect info
  let systemPrompt = context.systemPrompt;
  if (context.prospectName || context.prospectCompany) {
    systemPrompt += `\n\nINFORMACIÓN DEL PROSPECTO:\n`;
    if (context.prospectName) systemPrompt += `Nombre: ${context.prospectName}\n`;
    if (context.prospectCompany) systemPrompt += `Empresa: ${context.prospectCompany}\n`;
  }
  if (context.ragContext) {
    systemPrompt += `\n\nCONTEXTO RELEVANTE:\n${context.ragContext}`;
  }

  // Use Haiku for fast responses (sub-second latency target)
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300, // Keep responses concise for voice
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock?.text ?? '';
}

export async function generateCallSummary(
  transcript: TranscriptEntry[],
  agentName: string
): Promise<{ summary: string; outcome: string; sentiment_score: number; extracted_data: Record<string, unknown> }> {
  const transcriptText = transcript
    .map((t) => `${t.role === 'agent' ? agentName : 'Prospecto'}: ${t.content}`)
    .join('\n');

  // Use Sonnet for complex post-call analysis
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `Eres un analista de ventas experto. Analiza transcripciones de llamadas de ventas en español.

    Responde SIEMPRE con JSON válido en este formato exacto:
    {
      "summary": "Resumen de 2-3 oraciones de la llamada",
      "outcome": "uno de: interested|not_interested|callback|converted|voicemail|wrong_number|no_answer",
      "sentiment_score": número entre -1 (muy negativo) y 1 (muy positivo),
      "extracted_data": {
        "follow_up_date": "fecha si mencionaron una o null",
        "pain_points": ["lista de problemas mencionados"],
        "budget_mentioned": "presupuesto si se mencionó o null",
        "decision_maker": true/false,
        "next_steps": "próximos pasos acordados o null"
      }
    }`,
    messages: [
      {
        role: 'user',
        content: `Analiza esta transcripción de llamada de ventas:\n\n${transcriptText}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No response from Claude');

  try {
    return JSON.parse(textBlock.text);
  } catch {
    return {
      summary: textBlock.text.slice(0, 500),
      outcome: 'not_interested',
      sentiment_score: 0,
      extracted_data: {},
    };
  }
}
