import { createApp } from './app';
// We'll import actual adapters in the next step, for now using dummy implementations
import { IDatabase, ILLMProvider, Message } from '../../src/raven-integration/ravenChat';

class DummyDB implements IDatabase {
    async saveMessage(msg: Message) {}
    async updateMessageStatus(id: string, status: "success" | "failed", content?: string) {}
    async getHistory(sessionId: string) { return []; }
}
class DummyLLM implements ILLMProvider {
    async generateResponse(history: Message[], systemPrompt: string) { return "Dummy"; }
}

const app = createApp(new DummyDB(), new DummyLLM());
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
