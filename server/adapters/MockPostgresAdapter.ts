import { IDatabaseAdapter, ChatMessage, MessageStatus } from '../services/dialogueService';

export class MockPostgresAdapter implements IDatabaseAdapter {
  public messages: ChatMessage[] = [];
  public locks = new Set<string>();

  public failDbRead = false;
  public failReservation = false;
  public failCallingUpdate = false;
  public failSuccessSave = false;

  async acquireLock(sessionId: string): Promise<boolean> {
    if (this.locks.has(sessionId)) return false;
    this.locks.add(sessionId);
    return true;
  }
  async releaseLock(sessionId: string): Promise<void> { this.locks.delete(sessionId); }

  async checkRequestExists(requestId: string): Promise<ChatMessage | null> {
    if (this.failDbRead) throw new Error("DB Connection Lost");
    const msg = this.messages.find(m => m.requestId === requestId && m.role === 'assistant');
    return msg || null;
  }

  async acquireReservation(reqId: string, sess: string, pId: string, char: 'jonas'|'claire', content: string): Promise<ChatMessage | null> {
    if (this.failReservation) throw new Error("DB Reservation Error");
    if (this.messages.some(m => m.requestId === reqId)) return null;

    const usrMsg: ChatMessage = {
      id: `usr_${Date.now()}`, requestId: reqId, sessionId: sess, playerId: pId,
      character: char, role: 'user', content: content, status: 'success', timestamp: Date.now()
    };
    const astMsg: ChatMessage = {
      id: `ast_${Date.now()}`, requestId: reqId, sessionId: sess, playerId: pId,
      character: char, role: 'assistant', content: '', status: 'reserved', timestamp: Date.now()
    };
    this.messages.push(usrMsg, astMsg);
    return astMsg;
  }

  async updateMessageStatus(requestId: string, status: MessageStatus, content?: string): Promise<void> {
    if (status === 'calling' && this.failCallingUpdate) throw new Error("DB Error on calling");
    if ((status === 'success' || status === 'unknown') && this.failSuccessSave) throw new Error("DB Error on save");

    const msg = this.messages.find(m => m.requestId === requestId && m.role === 'assistant');
    if (msg) {
      msg.status = status;
      if (content !== undefined) msg.content = content;
    }
  }

  async getSessionHistory(sessionId: string, character: string): Promise<ChatMessage[]> {
    if (this.failDbRead) throw new Error("DB Connection Lost");
    return this.messages.filter(m => m.sessionId === sessionId && m.character === character && m.status === 'success');
  }
}
