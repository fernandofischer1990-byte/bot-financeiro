

## Web Search Integration for FinBot Chat

### Approach

Instead of using Brave Search (which requires a separate API key), we'll use the **Perplexity connector** which is available as a standard connector and provides AI-powered web search with grounded responses — perfect for financial queries like "quanto está o dólar" or "qual a inflação atual".

The integration will be done **server-side** inside the existing `chat` edge function, keeping the architecture simple: when the user's message matches web search intent, the edge function calls Perplexity, injects results into the LLM context, and the response includes sources.

### Implementation

#### 1. Connect Perplexity
Use the Perplexity connector to get the API key available as `PERPLEXITY_API_KEY` in edge functions.

#### 2. Modify `supabase/functions/chat/index.ts`
- Add a `shouldSearchWeb(message)` function with Portuguese keyword detection (dólar, inflação, selic, cotação, preço, CDI, etc.)
- Before calling the LLM, if web search is triggered, call Perplexity's chat API (`sonar` model) with the user's query
- Append web search results + citations to the system prompt context message
- Add a `web_sources` field to a final SSE event so the frontend can display sources

#### 3. Modify system prompt in `chat/index.ts`
Add instruction: "When web search results are provided, use them to answer and cite sources with markdown links."

#### 4. Create `src/services/webSearchService.ts`
Not needed — search happens server-side in the edge function. No new frontend service required.

#### 5. Modify `src/components/chat/ChatInterface.tsx`
- After streaming completes, extract sources from the response metadata
- Pass sources to `addMessage` as metadata: `{ sources: [...] }`

#### 6. Modify `src/components/chat/MessageBubble.tsx`
- Add a "Fontes" section below assistant messages when `message.metadata?.sources` exists
- Render each source as a clickable link with title

#### 7. Modify `src/services/chatService.ts`
- Update `sendChatMessage` to also accept an optional `webSearchQuery` parameter
- Or simpler: pass the web search intent flag in the request body and let the edge function handle it entirely

### Simplified Architecture

```text
User Message → ChatInterface.tsx
    → sendChatMessage() to chat edge function
    → Edge function detects web search intent
    → Calls Perplexity API (server-side)
    → Injects results into LLM context
    → Streams response with sources
    → Frontend displays message + sources
```

### File Summary

| File | Change |
|------|--------|
| `supabase/functions/chat/index.ts` | Add web search detection + Perplexity call + inject results into context |
| `src/components/chat/MessageBubble.tsx` | Add sources display section |
| `src/components/chat/ChatInterface.tsx` | Extract and persist sources metadata from response |
| `src/services/chatService.ts` | Minor: parse final SSE event for sources metadata |

### What stays the same
- All financial action parsing (add/delete transactions)
- SSE streaming
- Chat message persistence
- Import functionality
- Dashboard

### Prerequisites
- Connect Perplexity via the connector system (will prompt user)

