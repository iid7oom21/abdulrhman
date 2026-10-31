export interface Message {
  id: string;
  sessionId: string;
  playerId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: 'pending' | 'success' | 'failed';
  createdAt: number;
}

// Interfaces for our dependencies
export interface IDatabase {
  saveMessage(msg: Message): Promise<void>;
  updateMessageStatus(id: string, status: 'success' | 'failed', content?: string): Promise<void>;
  getHistory(sessionId: string): Promise<Message[]>;
}

export interface ILLMProvider {
  generateResponse(history: Message[], systemPrompt: string): Promise<string>;
}

export class RavenChatService {
  constructor(
    private db: IDatabase,
    private llm: ILLMProvider,
    private systemPrompt: string = "You are RAVEN, an intelligent NPC."
  ) {}

  async handlePlayerInput(playerId: string, sessionId: string, userInput: string): Promise<Message> {
    // 1. Prevent duplicate processing (simplified by assigning unique ID locally,
    // in real DB we might check for recent identical messages or rely on idempotency key).
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 2. Save the user's message immediately (Safe saving before processing)
    const userMessage: Message = {
      id: messageId,
      sessionId,
      playerId,
      role: 'user',
      content: userInput,
      status: 'success',
      createdAt: Date.now()
    };
    await this.db.saveMessage(userMessage);

    // 3. Fetch history for this session (Player isolation and knowledge)
    const history = await this.db.getHistory(sessionId);

    // 4. Create pending assistant message
    const assistantMessageId = `msg_ast_${Date.now()}`;
    const pendingAssistantMsg: Message = {
      id: assistantMessageId,
      sessionId,
      playerId,
      role: 'assistant',
      content: '', // empty initially
      status: 'pending',
      createdAt: Date.now()
    };
    await this.db.saveMessage(pendingAssistantMsg);

    try {
      // 5. Connect to Groq/LLM (Server-side)
      // Note: We pass the history to maintain context
      const allMessagesForPrompt = [...history, userMessage];
      const llmResponse = await this.llm.generateResponse(allMessagesForPrompt, this.systemPrompt);

      // Sanitize output (Safety against injection when rendered)
      const safeContent = this.sanitizeOutput(llmResponse);

      // 6. Update pending message to success
      await this.db.updateMessageStatus(assistantMessageId, 'success', safeContent);
      pendingAssistantMsg.content = safeContent;
      pendingAssistantMsg.status = 'success';

      return pendingAssistantMsg;

    } catch (error) {
      // Handle Unknown/Failed result
      await this.db.updateMessageStatus(assistantMessageId, 'failed', 'System error: Unable to process response.');
      pendingAssistantMsg.status = 'failed';
      pendingAssistantMsg.content = 'System error: Unable to process response.';
      return pendingAssistantMsg;
    }
  }

  private sanitizeOutput(rawText: string): string {
    // Basic HTML escaping to ensure safe rendering in frontend
    return rawText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
