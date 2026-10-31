export type MessageStatus =
  | 'reserved'
  | 'calling'
  | 'success'
  | 'failed'
  | 'unknown';

export interface ChatMessage {
  id: string;
  requestId: string;
  sessionId: string;
  playerId: string;
  character: 'jonas' | 'claire';
  role: 'user' | 'assistant';
  content: string;
  status: MessageStatus;
  timestamp: number;
}

export interface IDatabaseAdapter {
  checkRequestExists(requestId: string): Promise<ChatMessage | null>;
  getSessionHistory(sessionId: string, character: string): Promise<ChatMessage[]>;
  acquireReservation(requestId: string, sessionId: string, playerId: string, character: 'jonas' | 'claire', userMessage: string): Promise<ChatMessage | null>;
  updateMessageStatus(requestId: string, status: MessageStatus, content?: string): Promise<void>;
}

export interface ILLMAdapter {
  generateCharacterResponse(character: 'jonas' | 'claire', history: ChatMessage[]): Promise<string>;
}

export class DialogueService {
  constructor(private db: IDatabaseAdapter, private llm: ILLMAdapter) {}

  async handleDialogue(params: {
    playerId: string;
    sessionId: string;
    message: string;
    character: 'jonas' | 'claire';
    requestId: string;
  }): Promise<{ status: string; message?: ChatMessage; error?: string }> {

    let existingRequest: ChatMessage | null;
    try {
      existingRequest = await this.db.checkRequestExists(params.requestId);
    } catch (dbReadError) {
      return { status: 'cannot_verify', error: 'Database is unreachable. Cannot verify state.' };
    }

    if (existingRequest) {
      if (existingRequest.status === 'reserved' || existingRequest.status === 'calling') {
         return { status: 'in_progress_or_stuck', message: existingRequest };
      }
      return { status: 'success', message: existingRequest };
    }

    let reservation: ChatMessage | null;
    try {
      reservation = await this.db.acquireReservation(params.requestId, params.sessionId, params.playerId, params.character, params.message);
      if (!reservation) {
        return { status: 'concurrent_conflict', error: 'Failed to acquire reservation.' };
      }
    } catch (e) {
      return { status: 'cannot_verify', error: 'Failed to save reservation.' };
    }

    try {
      await this.db.updateMessageStatus(params.requestId, 'calling');
      reservation.status = 'calling';
    } catch (e) {
      return { status: 'cannot_verify', error: 'Failed to record calling intent.' };
    }

    let history: ChatMessage[] = [];
    try {
       history = await this.db.getSessionHistory(params.sessionId, params.character);
    } catch (e) {
       return { status: 'cannot_verify', error: 'Failed to fetch history.' };
    }

    let rawResponse: string;
    try {
      rawResponse = await this.llm.generateCharacterResponse(params.character, history);
    } catch (llmError: any) {
      if (llmError.isDefinitiveFailure) {
        await this.db.updateMessageStatus(params.requestId, 'failed');
        reservation.status = 'failed';
        reservation.content = 'System error: Definitive failure.';
        return { status: 'failed', message: reservation };
      } else {
        await this.db.updateMessageStatus(params.requestId, 'unknown');
        reservation.status = 'unknown';
        reservation.content = 'System error: Outcome unknown.';
        return { status: 'unknown', message: reservation };
      }
    }

    const safeResponse = this.sanitizeText(rawResponse);

    try {
      await this.db.updateMessageStatus(params.requestId, 'success', safeResponse);
      reservation.content = safeResponse;
      reservation.status = 'success';
      return { status: 'success', message: reservation };
    } catch (dbError) {
      reservation.content = safeResponse;
      reservation.status = 'unknown';
      return { status: 'unknown', message: reservation, error: 'Failed to confirm success save.' };
    }
  }

  private sanitizeText(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
}
