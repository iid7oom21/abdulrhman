import { buildContext, CHARACTERS } from './knowledge.js';
import { simulateReply } from './dialogue.js';

const REFUSAL = 'النص الأصلي لهذه الإفادة غير متاح في هذه المعاينة. لا أستطيع تأكيد تفاصيل الواقعة أو إنشاء دليل من الحوار.';

function receivedMaterials(context) {
  return context.received?.materials?.filter(item => item && typeof item.text === 'string') || [];
}

function groundedPayload(characterId, playerMessage, context) {
  return {
    characterId,
    characterName: CHARACTERS[characterId].name,
    allowedKnowledge: context.allowed,
    receivedStatements: receivedMaterials(context).map(item => ({
      type: item.type,
      text: item.text,
      author: item.author,
      isLatestKnownCorrection: item.isLatestKnownCorrection === true,
    })),
    playerMessage,
  };
}

function parseModelText(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!parsed || typeof parsed.text !== 'string' || !parsed.text.trim()) return null;
    return { text: parsed.text.trim().slice(0, 4000), refused: parsed.refused === true };
  } catch {
    return null;
  }
}

// Speaks only from approved knowledge and materials this character actually received.
// Empty knowledge and no shared materials never reach the model.
export function createGroundedReply({
  fetchImpl = globalThis.fetch,
  apiKey,
  baseUrl = 'https://api.x.ai/v1',
  model = 'grok-3',
  timeoutMs = 6000,
  fallback = simulateReply,
} = {}) {
  if (!apiKey || typeof fetchImpl !== 'function') throw new Error('model_not_configured');
  return async function generate(characterId, playerMessage, received) {
    const context = buildContext(characterId, received);
    const materials = receivedMaterials(context);
    if (!context.allowed.length && !materials.length) {
      return { ...fallback(characterId, playerMessage, received), source: 'deterministic-fallback' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(new URL('/chat/completions', baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: [
                'You speak as one RAVEN witness inside a grounded preview.',
                'Use only allowedKnowledge and receivedStatements. A received statement is attributed speech, not a proven fact.',
                'If the answer is not in those sources, refuse. Do not invent names, times, motives, evidence, endings, or the player’s presence.',
                'Do not turn a question into an accusation or a receipt. Reply in Arabic.',
                'Return JSON only: {"text":"...","refused":true|false}.',
              ].join(' '),
            },
            { role: 'user', content: JSON.stringify(groundedPayload(characterId, playerMessage, context)) },
          ],
        }),
      });
      if (!response.ok) throw new Error('model_http');
      const body = await response.json();
      const parsed = parseModelText(body?.choices?.[0]?.message?.content || '');
      if (!parsed || parsed.refused || parsed.text === REFUSAL) {
        return { ...fallback(characterId, playerMessage, received), source: 'deterministic-fallback' };
      }
      return { text: parsed.text, refused: false, source: 'grounded-model' };
    } catch {
      return { ...fallback(characterId, playerMessage, received), source: 'deterministic-fallback' };
    } finally {
      clearTimeout(timer);
    }
  };
}
