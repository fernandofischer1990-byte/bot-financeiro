

# Fix: Chat actions not reflecting in dashboard

## Root Cause Analysis

The user sends "gastei 80 no mercado", the AI correctly returns `<!--ACTION:{"action":"add_transaction",...}-->`, but the red toast "Nao consegui registrar automaticamente" appears and the transaction is never inserted.

The issue is in `readSSEStream` in `src/services/chatService.ts`:

1. **Lost buffer content**: When the stream ends (`done: true`), the function breaks immediately without processing any remaining content in the buffer. If the last SSE data line doesn't end with `\n`, that content is silently discarded.

2. **Infinite retry on parse failure**: The catch block puts the failed line back into the buffer with `break`, but on the next read cycle it tries to parse the SAME failed line again (since more data is appended AFTER the old content). If the JSON was split across TCP reads, the reassembled buffer has `old_partial\nnew_data`, but the inner while loop extracts `old_partial` again and fails again.

3. **No decoder flush**: `TextDecoder` with `{ stream: true }` buffers incomplete multi-byte characters (like `ã` in "alimentação"). When the loop exits, `decoder.decode()` is never called without args to flush remaining bytes, potentially corrupting the last chunk.

4. **Dangerous display regex**: `cleanContentForDisplay` has `\{[\s\S]*?"action"[\s\S]*?\}` which can match and remove legitimate content containing curly braces. Not the root cause but a fragility.

5. **No error logging**: When `extractAction` fails, the error is shown as a toast but never logged to console, making debugging impossible.

## Changes

### `src/services/chatService.ts` -- Fix SSE stream reader
- Process remaining buffer after the read loop ends (when `done: true`)
- Flush the TextDecoder after the loop to handle incomplete multi-byte characters
- Fix the catch block: instead of putting the line back in buffer (which causes infinite retry), skip malformed lines and continue
- Add `console.warn` for parse failures to aid debugging

### `src/components/chat/ChatInterface.tsx` -- Fix display regex and add logging
- Remove the dangerous greedy regex `\{[\s\S]*?"action"[\s\S]*?\}` from `cleanContentForDisplay` -- the `<!--ACTION:...-->` regex already handles action removal
- Add `console.error` in `parseAIResponse` when extraction fails, logging the raw content for debugging

### `src/components/chat/MessageBubble.tsx` -- Fix forwardRef warning
- The console shows "Function components cannot be given refs" warning from `MessageBubble`. Wrap with `React.forwardRef` or remove the ref attempt.

## Summary
3 files edited. No database changes. The core fix is making `readSSEStream` properly handle buffer remainder and TCP chunk boundaries so that `fullContent` always contains the complete AI response including the ACTION tag.

