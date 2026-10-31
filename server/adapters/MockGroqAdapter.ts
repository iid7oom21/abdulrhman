import { ILLMAdapter, ChatMessage } from '../services/dialogueService';

export class MockGroqAdapter implements ILLMAdapter {
  // Rule 6: Externalized counter outside the simulated crash boundary
  public globalCallCounter = 0;

  public delayMs = 0;
  public definitiveFailure = false;
  public unknownFailure = false;

  async generateCharacterResponse(character: 'jonas' | 'claire', history: ChatMessage[]): Promise<string> {
    this.globalCallCounter++;

    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }

    if (this.definitiveFailure) {
      const err: any = new Error("Auth Failed (401)");
      err.isDefinitiveFailure = true;
      throw err;
    }

    if (this.unknownFailure) {
      // E.g., timeout, network dropped. Not definitive.
      throw new Error("Connection Timeout");
    }

    return `Safe response for ${character}`;
  }
}
