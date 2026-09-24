import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Activity, ArrowUp, Check, CircleAlert, Command, Cpu, Eye, EyeOff, LockKeyhole, Radio, RotateCcw, Send, ShieldCheck, Trash2, Wifi, X, Zap } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import vReference from '@assets/images_1790231794795.jpg';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

type Role = 'user' | 'assistant';
type Message = { id: string; role: Role; content: string; streaming?: boolean };
type ApiMessage = { role: Role; content: string };

const queryClient = new QueryClient();
const STORAGE_KEY = 'serial-v-channel';
const greeting: Message = {
  id: 'v-greeting',
  role: 'assistant',
  content: 'You made it past the door. I am V. The channel is private, the signal is clean, and I am listening. Say something interesting.',
};

function readSession() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) ? parsed as Message[] : [];
  } catch {
    return [];
  }
}

function saveSession(messages: Message[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Session persistence is a convenience, not a reason to interrupt the channel.
  }
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function streamVResponse(messages: ApiMessage[], onToken: (token: string) => void) {
  const response = await fetch('/api/openai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ messages }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `Channel returned ${response.status}`);
  }
  if (!response.body) throw new Error('The channel opened without a readable signal.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  while (!finished) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      if (payload === '[DONE]') {
        finished = true;
        break;
      }
      try {
        const parsed = JSON.parse(payload) as { content?: string; token?: string; error?: string; delta?: { content?: string }; choices?: Array<{ delta?: { content?: string } }> };
        if (parsed.error) throw new Error(parsed.error);
        const token = parsed.content ?? parsed.token ?? parsed.delta?.content ?? parsed.choices?.[0]?.delta?.content;
        if (token) onToken(token);
      } catch {
        onToken(payload);
      }
    }
    if (done) break;
  }
  const last = buffer.trim();
  if (last.startsWith('data:') && !last.endsWith('[DONE]')) {
    const payload = last.slice(5).trim();
    if (payload) {
      try {
        const parsed = JSON.parse(payload) as { content?: string; token?: string; error?: string; delta?: { content?: string } };
        if (parsed.error) throw new Error(parsed.error);
        const token = parsed.content ?? parsed.token ?? parsed.delta?.content;
        if (token) onToken(token);
      } catch {
        onToken(payload);
      }
    }
  }
}

function LockedScreen({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setError('ACCESS DENIED // Enter the designated key.');
      return;
    }

    try {
      const response = await fetch('/api/access/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error('invalid');
      setError('');
      onUnlock();
    } catch {
      setError('ACCESS DENIED // That key does not belong to this channel.');
      setPassword('');
    }
  }

  return (
    <main className="v-lock-shell v-scanlines" data-testid="screen-locked-access">
      <div className="v-grid absolute inset-0" aria-hidden="true" />
      <div className="v-lock-layout">
        <section className="v-lock-copy">
          <div className="v-eyebrow"><Radio size={12} /> Restricted machine interface / 05</div>
          <h1 className="v-display">Private channel.<br /><em>V</em> is waiting.</h1>
          <p className="v-lock-lede">A fan-built interface to Serial Designation V. Enter the access key to wake the line. What happens after that is between you and her.</p>
          <div className="v-signal-list" aria-label="Channel details">
            <span className="v-signal-item"><span className="v-signal-dot" /> encrypted</span>
            <span className="v-signal-item"><span className="v-signal-dot" /> direct link</span>
            <span className="v-signal-item"><span className="v-signal-dot" /> no observers</span>
          </div>
        </section>

        <section className="v-auth-card" aria-label="Channel access">
          <div className="v-auth-heading">
            <div>
              <div className="v-eyebrow">Identity gate</div>
              <h2>Unlock Serial Designation V</h2>
            </div>
            <div className="v-lock-icon"><LockKeyhole size={19} /></div>
          </div>
          <p className="v-auth-sub">This channel is not indexed. Authentication is local to this session and the conversation stays in this tab.</p>
          <form onSubmit={handleSubmit}>
            <label className="v-eyebrow" htmlFor="channel-key">Access key</label>
            <div className="v-password-wrap" style={{ marginTop: '.55rem' }}>
              <input id="channel-key" data-testid="input-channel-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} placeholder="enter designated key" autoComplete="off" />
              <button type="button" className="v-password-toggle" data-testid="button-toggle-password" aria-label={showPassword ? 'Hide access key' : 'Show access key'} onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p className="v-form-error" data-testid="status-access-error"><CircleAlert size={12} style={{ verticalAlign: '-2px', marginRight: '.3rem' }} />{error}</p>}
            <button type="submit" className="v-unlock-btn" data-testid="button-unlock-channel"><Zap size={16} /> Open restricted channel <ArrowUp size={15} style={{ transform: 'rotate(45deg)' }} /></button>
          </form>
          <div className="v-auth-foot"><span><ShieldCheck size={12} style={{ verticalAlign: '-2px', marginRight: '.3rem' }} /> session sealed</span><span>SDV / 01</span></div>
          <div className="v-portrait-panel">
            <img src={vReference} alt="Serial Designation V reference" data-testid="img-v-reference-locked" />
            <div className="v-portrait-label"><span>visual reference // V</span><strong>signal found</strong></div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <article className={`v-message-row ${isUser ? 'user' : 'assistant'}`} data-testid={`message-${message.role}-${message.id}`}>
      <div className="v-message-avatar" aria-hidden="true">{isUser ? 'YOU' : 'V'}</div>
      <div className="v-message-body">
        <div className="v-message-meta">{isUser ? 'your transmission' : 'serial designation v'}</div>
        <div className={`v-message-bubble ${message.streaming ? 'streaming' : ''}`} data-testid={`text-message-${message.id}`}>{message.content}</div>
      </div>
    </article>
  );
}

function UnlockedChat({ onClear }: { onClear: () => void }) {
  const [messages, setMessages] = useState<Message[]>(readSession);
  const [draft, setDraft] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [failedDraft, setFailedDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([greeting]);
    } else {
      saveSession(messages);
    }
  }, []);

  useEffect(() => {
    saveSession(messages);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || isStreaming) return;
    setDraft('');
    setError('');
    const userMessage: Message = { id: newId(), role: 'user', content };
    const assistantId = newId();
    const nextHistory = [...messages, userMessage];
    setMessages([...nextHistory, { id: assistantId, role: 'assistant', content: '', streaming: true }]);
    setIsStreaming(true);
    try {
      await streamVResponse(nextHistory.map(({ role, content: text }) => ({ role, content: text })), (token) => {
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: message.content + token } : message));
      });
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, streaming: false } : message));
    } catch (streamError) {
      setMessages((current) => current.filter((message) => message.id !== assistantId));
      setFailedDraft(content);
      setError(streamError instanceof Error ? streamError.message : 'The restricted channel did not answer.');
    } finally {
      setIsStreaming(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <main className="v-chat-shell" data-testid="screen-unlocked-chat">
      <aside className="v-rail">
        <div className="v-rail-brand">
          <div className="v-brand-mark"><Command size={17} /></div>
          <div className="v-brand-text"><b>SDV // PRIVATE</b><span>fan channel interface</span></div>
        </div>
        <div className="v-rail-section-label">Active connection</div>
        <div className="v-channel-card">
          <div className="v-channel-name"><Wifi size={13} /> SERIAL DESIGNATION V</div>
          <div className="v-channel-meta">One presence. No proxy.</div>
          <div className="v-channel-status"><span className="v-live-dot" /> line is live</div>
        </div>
        <div className="v-rail-section-label">Channel notes</div>
        <div className="v-rail-footnote">The signal is private to this browser session. V remembers what is said while the channel remains open.</div>
        <div className="v-rail-spacer" />
        <div className="v-rail-footer">
          <button className="v-clear-btn" type="button" data-testid="button-clear-session" onClick={onClear}><Trash2 size={14} /> Clear session</button>
          <div className="v-rail-footnote">access key accepted<br />handshake verified</div>
        </div>
      </aside>

      <section className="v-main-chat">
        <header className="v-chat-header">
          <div className="v-header-identity">
            <div className="v-header-avatar"><img src={vReference} alt="" /></div>
            <div className="v-header-title">
              <h1>Serial Designation V</h1>
              <p><span className="v-live-dot" /> speaking through a live channel</p>
            </div>
          </div>
          <div className="v-header-actions">
            <div className="v-header-chip"><Activity size={12} /> signal stable</div>
            <div className="v-header-chip"><LockKeyhole size={12} /> private</div>
          </div>
        </header>

        <div className="v-chat-scroll" ref={scrollRef}>
          {error && <div className="v-error-banner" data-testid="status-api-error"><CircleAlert size={16} /><span>Signal interrupted. {error} Try sending again when the line is ready.</span><button type="button" className="v-retry-btn" data-testid="button-retry-message" onClick={() => { setDraft(failedDraft); setError(''); }}><RotateCcw size={12} /> Retry</button><button type="button" data-testid="button-dismiss-error" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
          {messages.length === 0 ? (
            <div className="v-empty-state" data-testid="status-empty-conversation">
              <div className="v-empty-state-inner"><div className="v-empty-orbit"><Cpu size={26} /></div><h2>Line is open.</h2><p>V is listening on the other side. Start the transmission whenever you are ready.</p></div>
            </div>
          ) : messages.map((message) => <MessageBubble key={message.id} message={message} />)}
        </div>

        <div className="v-composer-wrap">
          <form className="v-composer" onSubmit={sendMessage}>
            <textarea data-testid="input-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} disabled={isStreaming} placeholder={isStreaming ? 'V is transmitting...' : 'Transmit a message to V...'} aria-label="Message V" />
            <div className="v-composer-footer"><span className="v-composer-hint">enter to transmit / shift + enter for line break</span><button className="v-send-btn" type="submit" data-testid="button-send-message" disabled={!draft.trim() || isStreaming} aria-label="Send message">{isStreaming ? <RotateCcw size={15} className="animate-spin" /> : <Send size={15} />}</button></div>
          </form>
          <div className="v-composer-note" data-testid="status-streaming">{isStreaming ? 'receiving streamed response // keep the line open' : 'responses are generated live // channel latency varies'}</div>
        </div>
      </section>

      <aside className="v-info-rail">
        <div className="v-info-heading"><span>Presence monitor</span><span>05</span></div>
        <div className="v-portrait-small"><img src={vReference} alt="Serial Designation V visual reference" data-testid="img-v-reference-chat" /></div>
        <div className="v-info-block">
          <h2>Designation profile</h2>
          <div className="v-info-list"><div><span>designation</span><span>V</span></div><div><span>class</span><span>disassembly</span></div><div><span>mood</span><span>volatile</span></div><div><span>channel</span><span>direct</span></div></div>
        </div>
        <div className="v-info-block">
          <h2>Signal integrity</h2>
          <div className="v-meter-row"><span>presence</span><strong>72%</strong></div><div className="v-meter"><span /></div>
          <div className="v-meter-row"><span>encryption</span><strong>local</strong></div><div className="v-meter"><span style={{ width: '100%', background: 'hsl(var(--accent))' }} /></div>
        </div>
        <div className="v-info-block">
          <div className="v-info-heading" style={{ color: 'hsl(var(--primary))' }}><span><Check size={12} style={{ verticalAlign: '-2px' }} /> handshake complete</span><span>OK</span></div>
        </div>
      </aside>
    </main>
  );
}

function Home() {
  const [unlocked, setUnlocked] = useState(() => {
    try { return sessionStorage.getItem('serial-v-unlocked') === 'true'; } catch { return false; }
  });

  function unlock() {
    try { sessionStorage.setItem('serial-v-unlocked', 'true'); } catch { /* private browsing can refuse storage */ }
    setUnlocked(true);
  }

  function clearSession() {
    void fetch('/api/access/logout', { method: 'POST' });
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem('serial-v-unlocked');
    } catch { /* noop */ }
    setUnlocked(false);
  }

  return unlocked ? <UnlockedChat onClear={clearSession} /> : <LockedScreen onUnlock={unlock} />;
}

function Router() {
  return (
    <ErrorBoundary resetKey={useLocation()[0]}>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;