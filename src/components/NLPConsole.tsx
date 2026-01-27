import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send, Loader2, Sparkles, Package, ArrowRightLeft, ShoppingCart, Eye, HelpCircle, Trash2, Box, TruckIcon, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { ConsoleMessage, NLPResult } from '@/types/inventory';
import { DataTable } from './DataTable';
import { BillUploadDialog } from './BillUploadDialog';

interface NLPConsoleProps {
  onCommandExecuted?: () => void;
}

const quickActions = [
  { icon: Eye, label: 'View Products', command: 'Show all products', color: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600' },
  { icon: Box, label: 'Check Stock', command: 'Show stock levels', color: 'bg-green-500/10 hover:bg-green-500/20 text-green-600' },
  { icon: ShoppingCart, label: 'Pending Orders', command: 'Show pending orders', color: 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600' },
  { icon: ClipboardList, label: 'Transactions', command: 'Show recent transactions', color: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-600' },
  { icon: TruckIcon, label: 'Warehouses', command: 'Show warehouses', color: 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600' },
];

const suggestedCommands = [
  { text: "Take 10 units of [product] from [warehouse]", category: "Stock Out" },
  { text: "Add 20 more [product] to [warehouse]", category: "Stock In" },
  { text: "Order 50 [product] from [supplier] to [warehouse]", category: "Order" },
  { text: "Transfer 15 [product] from [warehouse A] to [warehouse B]", category: "Transfer" },
];

export function NLPConsole({ onCommandExecuted }: NLPConsoleProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ConsoleMessage[]>([
    {
      id: '1',
      type: 'system',
      content: '👋 Welcome! I\'m your inventory assistant. Tell me what you need in plain English, or click a quick action below to get started.',
      timestamp: new Date(),
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billUploadOpen, setBillUploadOpen] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
      addMessage('output', `🎯 **Here's what I can help you with:**

📦 **Stock Management**
• "Take 10 units of Widget from Main Warehouse"
• "Add 20 more Steel Bolts to East Warehouse"  
• "Return 5 units of Gadget to Storage"

🔄 **Transfers**
• "Transfer 15 items from Warehouse A to Warehouse B"
• "Move 30 units of Product X to Main Warehouse"

🛒 **Orders**
• "Order 100 units of Widget from ABC Supplies to Main Warehouse"
• "Mark order #5 as received"
• "Show pending orders"

👀 **View Data**
• "Show products" • "Show stock levels" • "Show warehouses"
• "Show orders" • "Show transactions" • "Show suppliers"

➕ **Add New Items**
• "Add product Gadget Pro at price 299"
• "Add warehouse North Storage"
• "Add supplier Tech Corp"

💡 **Tip:** Just type naturally! I understand commands like "I need to move some widgets to the main warehouse" too.`);
      return;
    }

    if (command.toLowerCase() === 'clear') {
      setMessages([{
        id: Date.now().toString(),
        type: 'system',
        content: '✨ Chat cleared! What would you like to do?',
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

  const renderMessage = (msg: ConsoleMessage) => {
    const typeConfig: Record<ConsoleMessage['type'], { bg: string; icon: string }> = {
      input: { bg: 'bg-primary/10 ml-12', icon: '💬' },
      output: { bg: 'bg-muted', icon: '📋' },
      error: { bg: 'bg-destructive/10', icon: '❌' },
      success: { bg: 'bg-green-500/10', icon: '✅' },
      warning: { bg: 'bg-yellow-500/10', icon: '⚠️' },
      system: { bg: 'bg-blue-500/10', icon: '🤖' },
    };

    const config = typeConfig[msg.type];

    return (
      <div key={msg.id} className={`rounded-lg p-3 mb-3 ${config.bg} animate-fade-in`}>
        <div className="flex gap-2">
          <span className="text-base">{config.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
            {msg.data && msg.data.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <DataTable data={msg.data} />
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const handleQuickAction = (command: string) => {
    processCommand(command);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden bg-card rounded-xl border shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Inventory Assistant</h3>
            <p className="text-xs text-muted-foreground">Ask me anything about your inventory</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMessages([{
              id: Date.now().toString(),
              type: 'system',
              content: '✨ Chat cleared! What would you like to do?',
              timestamp: new Date(),
            }])}
            className="h-8 w-8"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="px-3 py-2 border-b bg-muted/20 overflow-x-auto">
          <div className="flex gap-2">
            {quickActions.map((action, idx) => (
              <Button
                key={idx}
                variant="ghost"
                size="sm"
                onClick={() => handleQuickAction(action.command)}
                className={`flex-shrink-0 gap-1.5 ${action.color}`}
                disabled={isProcessing}
              >
                <action.icon className="w-3.5 h-3.5" />
                <span className="text-xs">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={outputRef}
          className="flex-1 overflow-y-auto p-4 space-y-1"
        >
          {messages.map(renderMessage)}
          {isProcessing && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Processing your request...</span>
            </div>
          )}
        </div>

        {/* Suggestions Panel */}
        {showSuggestions && (
          <div className="px-4 py-3 border-t bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Example commands:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedCommands.map((cmd, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(cmd.text)}
                  className="text-xs px-2 py-1 rounded-full bg-background border hover:bg-muted transition-colors"
                >
                  <span className="text-muted-foreground">{cmd.category}:</span> {cmd.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t p-3 bg-background">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="flex-shrink-0 h-10 w-10"
              title="Show examples"
            >
              <HelpCircle className="w-4 h-4" />
            </Button>
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Type what you need... (e.g., 'Show me all products' or 'Take 5 widgets from warehouse')"
                className="w-full min-h-[40px] max-h-[120px] px-3 py-2 text-sm rounded-lg border bg-muted/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={1}
                disabled={isProcessing}
              />
            </div>
            <Button 
              type="submit" 
              size="icon"
              disabled={isProcessing || !input.trim()}
              className="flex-shrink-0 h-10 w-10"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Press Enter to send • Type "help" for all commands
          </p>
        </div>
      </div>

      <BillUploadDialog 
        open={billUploadOpen}
        onOpenChange={setBillUploadOpen}
        orderId={pendingOrderId}
        onComplete={() => {
          setPendingOrderId(null);
          addMessage('success', '🎉 Bill uploaded successfully!');
        }}
      />
    </>
  );
}
