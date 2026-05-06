// Extract a (possibly partial) `message` value from a JSON stream-in-progress.
// Tolerates incomplete JSON: returns whatever has been streamed so far for the
// `message` field without requiring the closing brace or quote.

export function extractPartialMessage(buffer: string): string {
  if (!buffer) return '';

  // Find the start of the JSON object
  const objStart = buffer.indexOf('{');
  if (objStart === -1) {
    // Not JSON yet — show raw text
    return buffer.trim();
  }

  // Find "message" key
  const msgKeyMatch = buffer.slice(objStart).match(/"message"\s*:\s*"/);
  if (!msgKeyMatch) {
    // JSON started but message field not arrived yet
    return '';
  }

  const valueStart = objStart + msgKeyMatch.index! + msgKeyMatch[0].length;

  // Walk char-by-char respecting backslash escapes until unescaped closing quote
  let out = '';
  let i = valueStart;
  while (i < buffer.length) {
    const ch = buffer[i];
    if (ch === '\\') {
      const next = buffer[i + 1];
      if (next === undefined) break; // incomplete escape — stop here
      switch (next) {
        case 'n': out += '\n'; break;
        case 't': out += '\t'; break;
        case 'r': out += '\r'; break;
        case '"': out += '"'; break;
        case '\\': out += '\\'; break;
        case '/': out += '/'; break;
        case 'u': {
          const hex = buffer.slice(i + 2, i + 6);
          if (hex.length < 4) return out; // incomplete
          out += String.fromCharCode(parseInt(hex, 16));
          i += 4;
          break;
        }
        default: out += next;
      }
      i += 2;
      continue;
    }
    if (ch === '"') break; // end of string
    out += ch;
    i++;
  }
  return out;
}
