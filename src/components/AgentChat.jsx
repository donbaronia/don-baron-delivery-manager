import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Send, Bot, User } from 'lucide-react';

export default function AgentChat({ agentName, title, subtitle, greeting }) {
  const [conversations, setConversations] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const list = await base44.agents.listConversations({ agent_name: agentName });
      setConversations(list || []);
      if (list && list.length > 0 && !currentId) {
        setCurrentId(list[0].id);
      }
    } catch (e) {
      console.error('listConversations error:', e);
    } finally {
      setLoading(false);
    }
  }, [agentName]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!currentId) { setMessages([]); return; }
    const loadMsgs = async () => {
      try {
        const conv = await base44.agents.getConversation(currentId);
        setMessages(conv.messages || []);
      } catch (e) {
        console.error('getConversation error:', e);
      }
    };
    loadMsgs();
    const unsub = base44.agents.subscribeToConversation(currentId, (data) => {
      setMessages(data.messages || []);
      setSending(false);
    });
    return () => unsub();
  }, [currentId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleNewConversation = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: agentName,
        metadata: { name: `Análise ${new Date().toLocaleString('pt-BR')}`, description: 'Sessão do Agente de Segurança' }
      });
      setConversations([conv, ...conversations]);
      setCurrentId(conv.id);
      if (greeting) {
        setMessages([{ role: 'assistant', content: greeting }]);
      }
    } catch (e) {
      alert('Erro ao criar conversa: ' + e.message);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    if (!currentId) { await handleNewConversation(); }
    const conv = conversations.find((c) => c.id === currentId);
    const targetConv = conv || conversations[0];
    if (!targetConv) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    try {
      await base44.agents.addMessage(targetConv, { role: 'user', content: text });
    } catch (e) {
      setSending(false);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Erro: ' + e.message }]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Conversations sidebar */}
      <div className="w-64 border-r border-border/60 flex flex-col shrink-0">
        <div className="p-3 border-b border-border/60">
          <Button size="sm" className="w-full gap-2" onClick={handleNewConversation}>
            <Send className="w-3.5 h-3.5" />
            Nova Análise
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma análise iniciada.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setCurrentId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                  c.id === currentId ? 'bg-accent/10 border border-accent/30' : 'hover:bg-muted border border-transparent'
                }`}
              >
                <p className="font-medium truncate">{c.metadata?.name || 'Análise'}</p>
                <p className="text-xs text-muted-foreground truncate">{c.metadata?.description || ''}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="font-heading font-bold text-sm">{title}</p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <Bot className="w-12 h-12 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm max-w-xs">
                Inicie uma análise de segurança. Pergunte sobre tentativas suspeitas, motoboys ausentes, ou irregularidades no sistema de presença.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-accent" />
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border/60'
                }`}>
                  {msg.role === 'user'
                    ? <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    : <ReactMarkdown className="text-sm prose prose-sm max-w-none">{msg.content}</ReactMarkdown>
                  }
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          {sending && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-accent animate-pulse" />
              </div>
              <div className="bg-card border border-border/60 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border/60 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Pergunte sobre atividades suspeitas..."
              className="flex-1 rounded-lg border border-input bg-transparent px-4 py-2.5 text-sm focus-visible:ring-1 focus-visible:ring-ring outline-none"
              disabled={sending}
            />
            <Button onClick={handleSend} disabled={sending || !input.trim()} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}