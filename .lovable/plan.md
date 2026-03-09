
**Refactoring Plan for AI Financial Chat Assistant**

I will improve the AI chat assistant to make it more reliable, secure, and intelligent by transitioning to structured JSON responses and implementing safety layers.

### 1. Structure AI Responses (Backend & Parsing)
*   **`supabase/functions/chat/index.ts`**: Update the system prompt to enforce a strict JSON response format `{"message": "...", "action": {...}}`. I will remove the old regex-based HTML comment format. 
*   **`src/lib/actionParser.ts`**: Replace `extractAction` with robust JSON parsing using Zod. I'll add strict validations: `amount > 0`, valid categories, and valid dates. If parsing or validation fails, it will safely return an error without breaking the app.

### 2. Streaming Safety & Display Logic
*   **`src/components/chat/ChatInterface.tsx`**: Update the streaming display function (`cleanContentForDisplay`) to incrementally extract and render only the `"message"` string value while the JSON chunks are streaming in. Action execution will be strictly deferred until the stream is fully complete.

### 3. Safety & Confirmation Layer
*   **`src/components/chat/ChatInterface.tsx`**: 
    *   **User Confirmation**: Intercept `add_transaction` actions and display a confirmation dialog showing the transaction details (Type, Amount, Category, Description) before saving.
    *   **Duplicate Protection**: Before confirming, check if an identical transaction (same amount and category) was created in the last 2 minutes. If a duplicate is detected, the dialog will show a clear warning: *"This transaction looks like a duplicate. Do you want to add it anyway?"*

### 4. Better Financial Context
*   **`src/services/chatService.ts`**: Expand `ChatContext` to include `top_spending_categories`.
*   **`src/components/chat/ChatInterface.tsx`**: Compute the top categories from the existing `metrics` context and send them to the AI, enabling it to intelligently answer questions like *"What category do I spend the most on?"*

### 5. Error Logging & UX Polish
*   **Error Logging**: Implement `console.error("CHAT_ACTION_ERROR", { rawResponse, parsedAction, error })` for structured debugging.
*   **UX Improvements**: Update the initial quick suggestion buttons to match the new capabilities: *Add expense, Add income, Show monthly summary, Show my transactions*.
