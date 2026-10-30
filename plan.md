1. **Refactor dialogue.js for Persistence:** Update `server/ai-dialogue/src/dialogue.js` to use a JSON file (`store.json`) for `requests` and `shares` so that they survive server restarts. This handles the requirement: "تأكد من بقاء الطلب والرد ... بعد إعادة تشغيل الخادم".
2. **Update Frontend UI:** Add a badge/notice in the `App.tsx` UI clearly stating "هذه محاكاة (Simulation)" and list the un-tested acceptance criteria (real provider).
3. **Verify Persistence:** Restart the server and ensure the same `requestId` gives the same response and doesn't regenerate.
4. **Prepare Report:** Answer all questions, including explaining why a public URL is not possible in this isolated sandbox and what is needed for staging.
5. Submit the change using the `submit` tool.
