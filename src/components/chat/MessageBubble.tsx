import React from 'react';
import { cn } from '@/lib/utils';
import { Bot, User, Copy, Check } from 'lucide-react';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? 'Copiado' : 'Copiar resposta'}
      title={copied ? 'Copiado' : 'Copiar resposta'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch { /* ignore */ }
      }}
      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
import { ChatMessage } from '@/hooks/useChatMessages';

interface MessageBubbleProps {
  message: ChatMessage;
  cleanContent: (s: string) => string;
}

/**
 * Lightweight inline markdown renderer.
 * Supports: **bold**, *italic*, `code`, - bullet lists, ## headers, line breaks.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Tables: header row + separator row
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const splitRow = (r: string) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const header = splitRow(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        rows.push(splitRow(lines[j]));
        j++;
      }
      nodes.push(
        <div key={i} className="my-2 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-background/60">
              <tr>{header.map((h, k) => <th key={k} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">{inlineFormat(h)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-border even:bg-background/30">
                  {r.map((c, ci) => <td key={ci} className="px-2 py-1.5 whitespace-nowrap tabular-nums">{inlineFormat(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = j - 1;
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      nodes.push(<strong key={i} className="block text-sm font-semibold mt-2 mb-1">{inlineFormat(line.slice(4))}</strong>);
      continue;
    }
    if (line.startsWith('## ')) {
      nodes.push(<strong key={i} className="block text-sm font-semibold mt-2 mb-1">{inlineFormat(line.slice(3))}</strong>);
      continue;
    }
    if (line.startsWith('# ')) {
      nodes.push(<strong key={i} className="block font-bold mt-2 mb-1">{inlineFormat(line.slice(2))}</strong>);
      continue;
    }

    // Bullet lists
    if (line.match(/^[-•]\s/)) {
      nodes.push(
        <div key={i} className="flex gap-1.5 ml-1">
          <span className="text-muted-foreground">•</span>
          <span>{inlineFormat(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Empty line → spacing
    if (line.trim() === '') {
      nodes.push(<div key={i} className="h-1.5" />);
      continue;
    }

    // Regular line
    nodes.push(<span key={i}>{inlineFormat(line)}{i < lines.length - 1 ? <br /> : null}</span>);
  }

  return nodes;
}

/**
 * Inline formatting: **bold**, *italic*, `code`
 */
function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Regex matches **bold**, *italic*, `code`
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4]) {
      // `code`
      parts.push(<code key={match.index} className="px-1 py-0.5 bg-muted rounded text-xs font-mono">{match[4]}</code>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export const MessageBubble = React.forwardRef<HTMLDivElement, MessageBubbleProps>(
  function MessageBubble({ message, cleanContent }, ref) {
    const isUser = message.role === 'user';
    const displayContent = isUser ? message.content : cleanContent(message.content);

    if (!displayContent) return null;

    let time = '';
    try {
      if (message.created_at) {
        time = new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch { /* ignore */ }

    return (
      <div ref={ref} className={cn('flex gap-2 animate-fade-in', isUser && 'flex-row-reverse')}>
        <div className={cn(
          'p-2 rounded-full flex-shrink-0 h-8 w-8 flex items-center justify-center',
          isUser ? 'bg-primary' : 'bg-muted'
        )}>
          {isUser ? (
            <User className="h-4 w-4 text-primary-foreground" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </div>
        <div className={cn('max-w-[92%] lg:max-w-[85%] flex flex-col gap-1', isUser && 'items-end')}>
          <div className={cn(
            'rounded-2xl px-4 py-2',
            isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm'
          )}>
            <div className="text-sm leading-relaxed">
              {isUser ? displayContent : renderMarkdown(displayContent)}
            </div>
          </div>
          <div className="flex items-center gap-1 px-1">
            {time && <span className="text-[10px] text-muted-foreground tabular-nums">{time}</span>}
            {!isUser && <CopyButton text={displayContent} />}
          </div>
        </div>
      </div>
    );
  }
);

