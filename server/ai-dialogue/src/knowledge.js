// Only the recovered reference is available; it is not a transcript of these characters.
// No author secret, global game state, client-supplied facts or private dialogue enters context.
export const CHARACTERS = Object.freeze({
  jonas: Object.freeze({ id: 'jonas', name: 'يوناس', allowedKnowledge: Object.freeze([]) }),
  claire: Object.freeze({ id: 'claire', name: 'كلير', allowedKnowledge: Object.freeze([]) }),
});
export function buildContext(characterId) {
  if (!Object.hasOwn(CHARACTERS, characterId)) throw new Error('unknown_character');
  return { characterId, allowed: [...CHARACTERS[characterId].allowedKnowledge] };
}
