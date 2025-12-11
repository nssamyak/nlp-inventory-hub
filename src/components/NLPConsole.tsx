import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Send, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { ConsoleMessage, NLPResult } from '@/types/inventory';
import { DataTable } from './DataTable';
import { BillUploadDialog } from './BillUploadDialog';

interface NLPConsoleProps {
  onCommandExecuted?: () => void;
}

export function NLPConsole({ onCommandExecuted }: NLPConsoleProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ConsoleMessage[]>([
    {
      id: '1',
      type: 'system',
      content: 'Welcome to Inventory Management System. Type your command or "help" for available commands.',
      timestamp: new Date(),
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billUploadOpen, setBillUploadOpen] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = useCallback((type: ConsoleMessage['type'], content: string, data?: unknown[]) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      data
    }]);
  }, []);

  const processCommand = async (command: string) => {
    if (!command.trim()) return;

    // Add to history
    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);

    // Show help
    if (command.toLowerCase() === 'help') {
      addMessage('input', command);
      addMessage('output', `Available commands:
• Stock movements: "Take 10 units of [product] from [warehouse]"
• Returns: "Return 5 units of [product] to [warehouse]"
• Transfers: "Transfer 20 units of [product] from [warehouse A] to [warehouse B]"
• Orders: "Order 100 units of [product] from [supplier]"
• Status: "Update order #123 to received"
• View data: "Show products", "Show warehouses", "Show orders", "Show stock", "Show transactions"
• Add data: "Add product [name] at price [x]", "Add warehouse [name]", "Add supplier [name]"

Examples:
• "Show me all products"
• "Take 5 widgets from Main Warehouse"
• "Order 50 units of Steel Bolts from ABC Supplies"
• "Show pending orders"`);
      return;
    }

    if (command.toLowerCase() === 'clear') {
      setMessages([{
        id: Date.now().toString(),
        type: 'system',
        content: 'Console cleared. Type your command or "help" for available commands.',
        timestamp: new Date(),
      }]);
      return;
    }

    addMessage('input', command);
    setIsProcessing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nlp-parser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          addMessage('error', 'Rate limit exceeded. Please try again in a moment.');
          return;
        }
        throw new Error('Failed to process command');
      }

      const result: NLPResult = await response.json();

      if (result.success) {
        addMessage('success', result.message, result.data);
        
        if (result.requiresBillUpload && result.orderId) {
          setPendingOrderId(result.orderId);
          setBillUploadOpen(true);
        }
        
        onCommandExecuted?.();
      } else {
        addMessage('error', result.message || 'Command failed');
      }

    } catch (error) {
      console.error('Command error:', error);
      addMessage('error', 'Failed to process command. Please try again.');
      toast({
        title: 'Error',
        description: 'Failed to process command',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processCommand(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const renderMessage = (msg: ConsoleMessage) => {
    const typeStyles: Record<ConsoleMessage['type'], string> = {
      input: 'text-console-command',
      output: 'text-console-text',
      error: 'text-console-error',
      success: 'text-console-success',
      warning: 'text-console-warning',
      system: 'text-muted-foreground italic',
    };

    return (
      <div key={msg.id} className="animate-fade-in">
        {msg.type === 'input' && (
          <div className="flex items-start gap-2 mb-1">
            <ChevronRight className="w-4 h-4 text-console-prompt mt-0.5 flex-shrink-0" />
            <span className={`${typeStyles[msg.type]} font-medium`}>{msg.content}</span>
          </div>
        )}
        {msg.type !== 'input' && (
          <div className={`ml-6 mb-3 ${typeStyles[msg.type]} whitespace-pre-wrap`}>
            {msg.content}
            {msg.data && msg.data.length > 0 && (
              <div className="mt-3">
                <DataTable data={msg.data} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="console-container flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-console/50">
          <Terminal className="w-5 h-5 text-console-prompt" />
          <span className="font-mono text-sm text-console-text font-medium">NLP Command Console</span>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-warning/80" />
            <div className="w-3 h-3 rounded-full bg-success/80" />
          </div>
        </div>

        {/* Output */}
        <div 
          ref={outputRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-sm console-output bg-console"
        >
          {messages.map(renderMessage)}
          {isProcessing && (
            <div className="flex items-center gap-2 text-console-prompt animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-border/30 bg-console/80">
          <div className="flex items-center gap-2 px-4 py-3">
            <ChevronRight className="w-5 h-5 text-console-prompt flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter command... (type 'help' for available commands)"
              className="console-input flex-1"
              disabled={isProcessing}
              autoFocus
            />
            <Button 
              type="submit" 
              size="sm" 
              variant="ghost"
              disabled={isProcessing || !input.trim()}
              className="text-console-prompt hover:text-console-success hover:bg-console-success/10"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>

      <BillUploadDialog 
        open={billUploadOpen}
        onOpenChange={setBillUploadOpen}
        orderId={pendingOrderId}
        onComplete={() => {
          setPendingOrderId(null);
          addMessage('success', 'Bill uploaded successfully!');
        }}
      />
    </>
  );
}
