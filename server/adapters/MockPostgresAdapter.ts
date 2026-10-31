import { IDatabaseAdapter, ChatMessage, MessageStatus } from '../services/dialogueService';

export class MockPostgresAdapter implements IDatabaseAdapter {
  public messages: ChatMessage[] = [];
  public failDbRead = false;
  public failReservation = false;
  public failCallingUpdate = false;
  public failSuccessSave = false;

  async checkRequestExists(requestId: string): Promise<ChatMessage | null> {
    if (this.failDbRead) throw new Error("DB Connection Lost");
    const msg = this.messages.find(m => m.requestId === requestId);
    return msg || null;
  }

  async acquireReservation(reqId: string, sess: string, pId: string, char: 'jonas'|'claire', content: string): Promise<ChatMessage | null> {
    if (this.failReservation) throw new Error("DB Reservation Error");

    // Check concurrent uniqueness based on requestId
    if (this.messages.some(m => m.requestId === reqId)) return null;

    const reservation: ChatMessage = {
      id: `msg_${Date.now()}`,
      requestId: reqId,
      sessionId: sess,
      playerId: pId,
      character: char,
      role: 'assistant',
      content: '', // not generated yet
      status: 'reserved',
      timestamp: Date.now()
    };
    this.messages.push(reservation);
    return reservation;
  }

  async updateMessageStatus(requestId: string, status: MessageStatus, content?: string): Promise<void> {
    if (status === 'calling' && this.failCallingUpdate) throw new Error("DB Error on calling");
    if ((status === 'success' || status === 'unknown') && this.failSuccessSave) {
      throw new Error("DB Error on save");
    }

    const msg = this.messages.find(m => m.requestId === requestId);
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
