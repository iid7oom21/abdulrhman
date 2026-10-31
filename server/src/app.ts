import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { RavenChatService, IDatabase, ILLMProvider } from '../../src/raven-integration/ravenChat';

export const createApp = (db: IDatabase, llm: ILLMProvider) => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const ravenService = new RavenChatService(db, llm);

  // In-memory concurrency lock store
  const activeRequests = new Set<string>();

  app.post('/api/raven/chat', async (req, res) => {
    try {
      const { playerId, sessionId, message, fingerprint } = req.body;

      if (!playerId || !sessionId || !message) {
        return res.status(400).json({ error: 'Missing required fields (playerId, sessionId, message)' });
      }

      // Concurrency lock using a combination of playerId and sessionId
      const lockKey = `${playerId}:${sessionId}`;
      if (activeRequests.has(lockKey)) {
        return res.status(429).json({ error: 'Please wait for the previous response to finish.' });
      }

      activeRequests.add(lockKey);

      try {
        // Enforce ownership: We log fingerprint context in real app, but for now we just process
        const responseMessage = await ravenService.handlePlayerInput(playerId, sessionId, message);

        if (responseMessage.status === 'failed') {
            return res.status(500).json({ message: responseMessage });
        }

        return res.status(200).json({ message: responseMessage });
      } finally {
        activeRequests.delete(lockKey);
      }

    } catch (error) {
      console.error('Chat endpoint error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
};
