// سياق معرفة مستقل لكل شخصية — مستمد من BELHAQAK-GUEST-WITNESS-20261030
export const CHARACTERS = {
  jonas: {
    id: 'jonas',
    name: 'يوناس',
    allowedKnowledge: [
      'hall_conversation_before_scream',
      'heard_scream_with_player',
      'stayed_in_hall_to_call_reception',
    ],
    forbidden: ['envelope_contents', 'victor_meeting_details', 'claire_private_messages'],
  },
  claire: {
    id: 'claire',
    name: 'كلير',
    allowedKnowledge: [
      'arranged_invitations',
      'victor_said_player_is_guest',
      'seat_cards_arrangement',
    ],
    forbidden: ['envelope_contents_unless_shared', 'player_private_corrections'],
  },
};

export function buildContext(characterId, sharedFacts = []) {
  const char = CHARACTERS[characterId];
  if (!char) throw new Error('unknown_character');
  return {
    characterId,
    allowed: [...char.allowedKnowledge, ...sharedFacts],
    forbidden: char.forbidden,
  };
}
