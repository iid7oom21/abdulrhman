import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RavenChatService, IDatabase, ILLMProvider, Message } from './ravenChat';

// Mock DB
class MockDB implements IDatabase {
  public messages: Message[] = [];

  async saveMessage(msg: Message) {
    this.messages.push(msg);
  }

  async updateMessageStatus(id: string, status: 'success' | 'failed', content?: string) {
    const msg = this.messages.find(m => m.id === id);
    if (msg) {
      msg.status = status;
      if (content !== undefined) msg.content = content;
    }
  }

  async getHistory(sessionId: string) {
    return this.messages.filter(m => m.sessionId === sessionId && m.status === 'success');
  }
}

// Mock LLM
class MockLLM implements ILLMProvider {
  async generateResponse(history: Message[], systemPrompt: string) {
    return "This is a <script>alert('safe')</script> response.";
  }
}

describe('RavenChatService', () => {
  let db: MockDB;
  let llm: MockLLM;
  let service: RavenChatService;

  beforeEach(() => {
    db = new MockDB();
    llm = new MockLLM();
    service = new RavenChatService(db, llm);
  });

  it('should save user message and return successful assistant response', async () => {
    const response = await service.handlePlayerInput('player1', 'sessionA', 'Hello RAVEN');

    expect(response.status).toBe('success');
    // Check sanitation
    expect(response.content).toBe('This is a &lt;script&gt;alert(&#039;safe&#039;)&lt;/script&gt; response.');

    // Check DB state
    expect(db.messages.length).toBe(2);
    expect(db.messages[0].role).toBe('user');
    expect(db.messages[1].role).toBe('assistant');
    expect(db.messages[1].status).toBe('success');
  });

  it('should handle LLM failure gracefully and save failed status', async () => {
    // Override to throw error
    llm.generateResponse = vi.fn().mockRejectedValue(new Error("API Timeout"));

    const response = await service.handlePlayerInput('player2', 'sessionB', 'Fail please');

    expect(response.status).toBe('failed');
    expect(response.content).toContain('System error');

    const pendingMsg = db.messages.find(m => m.role === 'assistant');
    expect(pendingMsg?.status).toBe('failed');
  });

  it('should isolate history by session', async () => {
    await service.handlePlayerInput('player1', 'sessionA', 'Hello A');
    await service.handlePlayerInput('player1', 'sessionB', 'Hello B');

    const historyA = await db.getHistory('sessionA');
    const historyB = await db.getHistory('sessionB');

    expect(historyA.length).toBe(2); // user + assistant
    expect(historyB.length).toBe(2);
  });
});
