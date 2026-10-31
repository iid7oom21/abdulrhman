import { ILLMAdapter, ChatMessage } from '../services/dialogueService';

export class MockGroqAdapter implements ILLMAdapter {
  public globalCallCounter = 0;
  public delayMs = 0;
  public definitiveFailure = false;
  public unknownFailure = false;

  async generateCharacterResponse(character: 'jonas' | 'claire', history: ChatMessage[]): Promise<string> {
    this.globalCallCounter++;
    if (this.delayMs > 0) await new Promise(resolve => setTimeout(resolve, this.delayMs));
    if (this.definitiveFailure) {
      const err: any = new Error("Auth Failed (401)");
      err.isDefinitiveFailure = true;
      throw err;
    }
    if (this.unknownFailure) throw new Error("Connection Timeout");

    // Proving context inclusion (user msg + char context)
    return `Hello, I am ${character}. Last msg: ${history.length ? history[history.length-1].content : ''} <script>alert('xss')</script>`;
  }
}
