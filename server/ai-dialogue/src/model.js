import { createCompatibleReply } from './provider.js';

// Existing integration entry point. The provider selects received material IDs;
// the server quotes them with attribution instead of accepting invented testimony.
export function createGroundedReply({apiKey, baseUrl = 'https://api.x.ai/v1', model = 'grok-3', timeoutMs = 6000, fetchImpl = globalThis.fetch} = {}) {
  return createCompatibleReply({apiKey,baseUrl,model,timeoutMs,fetchImpl});
}
