import React from 'react';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
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

    return (
      <div ref={ref} className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
        <div className={cn(
          'p-2 rounded-full flex-shrink-0',
          isUser ? 'bg-primary' : 'bg-muted'
        )}>
          {isUser ? (
            <User className="h-4 w-4 text-primary-foreground" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </div>
        <div className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}>
          <div className="text-sm">
            {isUser ? displayContent : renderMarkdown(displayContent)}
          </div>
        </div>
      </div>
    );
  }
);
