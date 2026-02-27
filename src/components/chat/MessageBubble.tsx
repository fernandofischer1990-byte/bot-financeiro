import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import { ChatMessage } from '@/hooks/useChatMessages';

interface MessageBubbleProps {
  message: ChatMessage;
  cleanContent: (s: string) => string;
}

export function MessageBubble({ message, cleanContent }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const displayContent = isUser ? message.content : cleanContent(message.content);

  if (!displayContent) return null;

  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
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
        <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
      </div>
    </div>
  );
}
