import { Router } from 'express';
import { DialogueService } from '../services/dialogueService';
import { MockGroqAdapter } from '../adapters/MockGroqAdapter';
import { MockPostgresAdapter } from '../adapters/MockPostgresAdapter';

export const dialogueRouter = Router();

const dbAdapter = new MockPostgresAdapter();
const llmAdapter = new MockGroqAdapter();
const dialogueService = new DialogueService(dbAdapter, llmAdapter);

dialogueRouter.post('/dialogue', async (req, res) => {
  try {
    const { playerId, sessionId, message, character, requestId } = req.body;

    if (!playerId || !sessionId || !message || !character || !requestId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const response = await dialogueService.handleDialogue({
      playerId,
      sessionId,
      message,
      character,
      requestId
    });

    if (response.status === 'cannot_verify') {
       return res.status(503).json({ error: response.error, details: response });
    }
    if (response.status === 'unknown') {
      return res.status(502).json({ error: 'Outcome unknown', details: response });
    }
    if (response.status === 'failed') {
      return res.status(500).json({ error: 'Definitive failure', details: response });
    }
    if (response.status === 'in_progress_or_stuck') {
      return res.status(202).json({ warning: 'Last known state is reserved or calling', details: response });
    }
    if (response.status === 'concurrent_conflict') {
      return res.status(409).json({ error: response.error || 'Conflict' });
    }

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});
