"use client";

import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getActiveConversationId,
  readLocalConversations,
  saveLocalConversation,
  setActiveConversationId,
  writeLocalConversations,
  type ChatMessage,
  type ConversationRecord,
} from "@/lib/chat-storage";
import {
  defaultAccountPreferences,
  readLocalAccountPreferences,
  saveLocalAccountPreferences,
} from "@/lib/account-preferences";

type ProviderStatus = { id: string; name: string; model: string; configured: boolean };
type SessionStatus = { authenticated: boolean; databaseConfigured: boolean };
type ChatAttachment = { name: string; text: string; fileId?: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState("openrouter");
  const [language, setLanguage] = useState(defaultAccountPreferences.language);
  const [autoRead, setAutoRead] = useState(defaultAccountPreferences.autoRead);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [session, setSession] = useState<SessionStatus>({ authenticated: false, databaseConfigured: false });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const conversationId = useRef<string | null>(null);
  const markdownComponents = {
    pre: ({ children }: { children?: ReactNode }) => {
      const codeElement = Children.toArray(children).find(isValidElement);
      const codeProps = isValidElement<{ className?: string; children?: ReactNode }>(codeElement)
        ? codeElement.props
        : undefined;
      const language = codeProps?.className?.match(/language-([\w+#.-]+)/)?.[1] ?? "code";
      const codeText = codeProps?.children
        ? String(codeProps.children).replace(/\n$/, "")
        : "";

      return (
        <div className="my-4 min-w-0 overflow-hidden rounded-xl border border-cyan-300/20 bg-[#081725] shadow-lg shadow-black/20">
          <div className="flex items-center justify-between border-b border-cyan-200/10 bg-[#10263a] px-3 py-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-cyan-200">{language}</span>
            <button onClick={() => void copyMessage(codeText)} className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white">Copy code</button>
          </div>
          <pre className="max-w-full overflow-x-auto p-4 text-[13px] leading-6 text-cyan-100">{children}</pre>
        </div>
      );
    },
    code: ({ className, children, ...props }: { className?: string; children?: ReactNode } & React.HTMLAttributes<HTMLElement>) => {
      const isCodeBlock = Boolean(className?.startsWith("language-"));
      return (
        <code
          className={isCodeBlock
            ? "whitespace-pre font-mono text-cyan-100"
            : "rounded bg-violet-300/10 px-1.5 py-0.5 font-mono text-amber-200"}
          {...props}
        >
          {children}
        </code>
      );
    },
  };

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      const localPreferences = readLocalAccountPreferences();
      setProvider(localPreferences.preferredProvider);
      setLanguage(localPreferences.language);
      setAutoRead(localPreferences.autoRead);
    });
    Promise.resolve().then(() => {
      try {
        const conversations = readLocalConversations();
        const currentId = getActiveConversationId();
        const current = conversations.find((item) => item.id === currentId) ?? conversations[0];
        if (current && active) {
          conversationId.current = current.id;
          setMessages(current.messages);
        }
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : "Could not read local chat history.");
      }
    });
    Promise.all([
      fetch("/api/status").then((response) => response.json()),
      fetch("/api/session").then((response) => response.json()),
    ]).then(([providerStatus, sessionStatus]) => {
      if (!active) return;
      setProviders(providerStatus.providers ?? []);
      setSession({
        authenticated: Boolean(sessionStatus.authenticated),
        databaseConfigured: Boolean(sessionStatus.databaseConfigured),
      });
    }).catch(() => {
      if (active) setNotice("Could not load account or model status.");
    });
    fetch("/api/preferences").then((response) => {
      if (!response.ok) throw new Error("Could not load account preferences.");
      return response.json();
    }).then((preferenceStatus) => {
      if (!active) return;
      if (preferenceStatus.synced) {
        setProvider(preferenceStatus.preferences.preferredProvider);
        setLanguage(preferenceStatus.preferences.language);
        setAutoRead(preferenceStatus.preferences.autoRead);
        saveLocalAccountPreferences(preferenceStatus.preferences);
      }
    }).catch(() => {
      if (active) setNotice("Using browser-saved preferences; account preferences could not be loaded.");
    });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    const endElement = endRef.current;
    if (endElement) endElement.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function persistConversation(updatedMessages: ChatMessage[]) {
    const userMessage = updatedMessages.find((message) => message.role === "user");
    const record: ConversationRecord = {
      id: conversationId.current ?? crypto.randomUUID(),
      title: (userMessage?.content ?? "New conversation").slice(0, 60),
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    };
    conversationId.current = record.id;
    try {
      saveLocalConversation(record);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save chat in this browser.");
      return;
    }

    if (!session.authenticated || !session.databaseConfigured) {
      setNotice("Saved in this browser. Sign in and configure PostgreSQL for synced history.");
      return;
    }

    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, title: record.title, messages: updatedMessages }),
      });
      if (!response.ok) {
        setNotice("Saved in this browser; cloud sync failed.");
        return;
      }
      const result = await response.json();
      const savedId = result.conversation?.id as string | undefined;
      if (savedId && savedId !== record.id) {
        const syncedRecord = { ...record, id: savedId };
        conversationId.current = savedId;
        const existing = readLocalConversations();
        writeLocalConversations(existing.filter((item) => item.id !== record.id));
        saveLocalConversation(syncedRecord);
      }
      setNotice("Conversation saved to your account.");
    } catch {
      setNotice("Saved in this browser; cloud sync is unavailable.");
    }
  }

  async function send() {
    const typedText = input.trim();
    const currentAttachment = attachment;
    const text = currentAttachment
      ? `${typedText || "Please analyze this document."}\n\n[Attached document: ${currentAttachment.name}]\n${currentAttachment.text}`
      : typedText;
    if (!text || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setAttachment(null);
    setLoading(true);
    setNotice("");
    controller.current = new AbortController();
    let assistantText = "";
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, provider, language }),
        signal: controller.current.signal,
      });
      if (!response.ok) throw new Error(`Chat request failed (${response.status}).`);
      if (!response.body) throw new Error("The server returned no response stream.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let pendingText = "";
      let frame = 0;
      const flushText = () => {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        pendingText = "";
        setMessages((current) => {
          const copy = [...current];
          copy[copy.length - 1] = { role: "assistant", content: assistantText };
          return copy;
        });
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5).trim()) as { text?: string; error?: string; notice?: string };
          if (event.error) throw new Error(event.error);
          if (event.notice) setNotice(event.notice);
          if (event.text) {
            assistantText += event.text;
            pendingText += event.text;
            if (!frame) frame = requestAnimationFrame(flushText);
          }
        }
      }
      if (buffer.startsWith("data:")) {
        const event = JSON.parse(buffer.slice(5).trim()) as { text?: string; error?: string; notice?: string };
        if (event.error) throw new Error(event.error);
        if (event.notice) setNotice(event.notice);
        if (event.text) assistantText += event.text;
      }
      if (pendingText || assistantText) flushText();
      if (assistantText) {
        await persistConversation([...next, { role: "assistant", content: assistantText }]);
        if (currentAttachment?.fileId && session.authenticated && session.databaseConfigured && conversationId.current) {
          try {
            const linkResponse = await fetch("/api/files", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileId: currentAttachment.fileId, conversationId: conversationId.current }),
            });
            if (!linkResponse.ok) setNotice("Chat saved, but the document could not be linked to it.");
          } catch {
            setNotice("Chat saved, but document linking is unavailable.");
          }
        }
        if (autoRead && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const speech = new SpeechSynthesisUtterance(assistantText);
          speech.lang = language === "bn" ? "bn-BD" : "en-US";
          window.speechSynthesis.speak(speech);
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        const message = error instanceof Error ? error.message : "Chat request failed.";
        setMessages((current) => [...current.slice(0, -1), { role: "assistant", content: `Error: ${message}` }]);
        setNotice(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function copyMessage(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setNotice("Message copied.");
    } catch {
      setNotice("Clipboard access is unavailable in this browser.");
    }
  }

  function startVoiceInput() {
    type Recognition = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      start: () => void;
      onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
    };
    const browser = window as Window & {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const SpeechRecognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotice("Speech input is not supported by this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "bn-BD";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      setInput((current) => `${current} ${event.results[0][0].transcript}`.trim());
    };
    recognition.onerror = () => setNotice("Microphone permission or speech recognition failed.");
    recognition.start();
  }

  function speakMessage(content: string) {
    if (!("speechSynthesis" in window)) {
      setNotice("Voice playback is not supported by this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = /[\u0980-\u09FF]/.test(content) ? "bn-BD" : "en-US";
    window.speechSynthesis.speak(utterance);
  }

  function stopVoice() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function newChat() {
    stopVoice();
    conversationId.current = null;
    setAttachment(null);
    setActiveConversationId("");
    setMessages([]);
    setNotice("");
  }

  async function attachFile(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      setNotice("File exceeds the 4 MB upload limit.");
      return;
    }
    setNotice("Extracting document text...");
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/files", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not read this document.");
      setAttachment({
        name: data.name,
        text: String(data.text).slice(0, 20_000),
        ...(data.file?.id ? { fileId: data.file.id } : {}),
      });
      setNotice(data.stored ? "Document ready and saved to your account." : "Document ready for this chat only.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not read this document.");
    }
  }

  async function changeProvider(value: string) {
    if (!["gemini", "grok", "openrouter"].includes(value)) return;
    const updated = {
      ...readLocalAccountPreferences(),
      preferredProvider: value as "gemini" | "grok" | "openrouter",
    };
    setProvider(updated.preferredProvider);
    saveLocalAccountPreferences(updated);
    if (session.authenticated && session.databaseConfigured) {
      try {
        const response = await fetch("/api/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        if (!response.ok) {
          const data = await response.json();
          setNotice(data.error ?? "Could not sync provider preference.");
        }
      } catch {
        setNotice("Provider preference saved locally; account sync failed.");
      }
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[#08111f] text-white">
      <header className="flex flex-col gap-3 border-b border-white/8 px-3 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-0 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 font-bold">A</Link>
          <div><b>ALIF AI</b><p className="text-xs text-slate-400">AI Chat</p></div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <Link href="/history" className="rounded-lg border border-white/10 px-2.5 py-2 text-xs sm:px-3 sm:text-sm">History</Link>
          {!session.authenticated && <Link href="/login" className="rounded-lg border border-white/10 px-2.5 py-2 text-xs sm:px-3 sm:text-sm">Sign in</Link>}
          <button onClick={newChat} className="rounded-lg border border-white/10 px-2.5 py-2 text-xs sm:px-3 sm:text-sm">New chat</button>
          <select aria-label="AI provider" value={provider} onChange={(event) => void changeProvider(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#101d31] px-2 py-2 text-xs outline-none sm:max-w-44 sm:flex-none sm:px-3 sm:text-sm">
            {providers.map((item) => <option key={item.id} value={item.id}>{item.name}{item.configured ? "" : " — not configured"}</option>)}
          </select>
        </div>
      </header>
      <section className="mx-auto flex h-[calc(100dvh-120px)] min-h-60 max-w-4xl flex-col px-3 sm:h-[calc(100dvh-64px)] sm:px-4">
        <div className="min-h-0 flex-1 overflow-y-auto py-5 sm:py-8">
          {messages.length === 0 && <div className="mx-auto mt-24 max-w-lg text-center"><div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-2xl font-bold">A</div><h1 className="text-2xl font-bold">How can I help you?</h1><p className="mt-2 text-sm text-slate-400">Ask in Bengali or English.</p></div>}
          {messages.map((message, index) => (
            <div key={`${index}-${message.role}`} className={`mb-5 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`min-w-0 max-w-[95%] rounded-2xl px-3 py-3 text-sm leading-7 sm:max-w-[85%] sm:px-4 ${message.role === "user" ? "break-words bg-blue-600" : "overflow-hidden border border-white/8 bg-[#101d31]"}`}>
                {message.role === "assistant" ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{message.content}</ReactMarkdown> : message.content}
                {message.role === "assistant" && message.content && <div className="mt-2 flex gap-3 text-xs text-slate-400">
                  <button onClick={() => void copyMessage(message.content)} className="hover:text-white">Copy</button>
                  <button onClick={() => speakMessage(message.content)} className="hover:text-white">Read aloud</button>
                  <button onClick={stopVoice} className="hover:text-white">Stop voice</button>
                </div>}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="shrink-0 pb-3 sm:pb-5">
          {notice && <p role="status" className="mb-2 text-xs text-slate-400">{notice}</p>}
          {attachment && <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-violet-400/20 bg-violet-400/5 px-3 py-2 text-xs text-violet-100"><span className="min-w-0 truncate">Attached: {attachment.name} · text included with your next message</span><button onClick={() => setAttachment(null)} aria-label="Remove attached document" className="shrink-0">Remove</button></div>}
          <input ref={fileInput} type="file" accept=".pdf,.txt,.docx" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void attachFile(file); event.target.value = ""; }} />
          <div className="flex items-end gap-1.5 rounded-2xl border border-white/10 bg-[#101d31] p-1.5 sm:gap-2 sm:p-2">
            <textarea aria-label="Message ALIF AI" rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Message ALIF AI..." className="max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-3 text-base outline-none sm:px-3 sm:text-sm" />
            <button onClick={() => fileInput.current?.click()} aria-label="Attach PDF, TXT, or DOCX" title="Attach PDF, TXT, or DOCX" className="h-11 w-10 shrink-0 rounded-xl border border-white/10 px-2 text-slate-300 sm:w-auto sm:px-3"><span className="sm:hidden">+</span><span className="hidden sm:inline">Attach</span></button>
            <button onClick={startVoiceInput} aria-label="Voice input" title="Voice input" className="h-11 w-10 shrink-0 rounded-xl border border-white/10 px-2 text-slate-300 sm:w-auto sm:px-3">Mic</button>
            {loading ? <button onClick={() => controller.current?.abort()} className="h-11 shrink-0 rounded-xl bg-red-500/20 px-3 text-red-300 sm:px-4"><span className="sm:hidden">■</span><span className="hidden sm:inline">Stop</span></button> : <button onClick={() => void send()} className="h-11 shrink-0 rounded-xl bg-blue-600 px-3 font-semibold hover:bg-blue-500 sm:px-5"><span className="sm:hidden">➤</span><span className="hidden sm:inline">Send</span></button>}
          </div>
        </div>
      </section>
    </main>
  );
}
