import { useState, useEffect, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faTrash,
  faRobot,
  faUser,
  faSpinner,
  faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import {
  invokeAgent,
  listAvailableAgents,
  type AvailableAgent,
  type AgentInvokeResult,
} from "../api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  // Assistant-only metadata
  agent_name?: string;
  model?: string;
  tokens?: { prompt: number; completion: number; total: number };
  duration_ms?: number;
  tool_results?: unknown[];
  success?: boolean;
}

const SESSION_KEY = "proxlab_chat_sessions";
const ACTIVE_KEY = "proxlab_chat_active";

interface ChatSession {
  id: string;
  label: string;
  agentId: string;
  messages: ChatMessage[];
  created: number;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(t: { prompt: number; completion: number; total: number }) {
  return `${t.total} tok (${t.prompt}p / ${t.completion}c)`;
}

export default function ChatPage() {
  const [agents, setAgents] = useState<AvailableAgent[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [activeId, setActiveId] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_KEY)
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load available agents
  useEffect(() => {
    listAvailableAgents()
      .then(setAgents)
      .catch((err) => console.error("Failed to load agents:", err));
  }, []);

  // Persist sessions on change
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  // Persist active session
  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
    else localStorage.removeItem(ACTIVE_KEY);
  }, [activeId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, activeId]);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;
  const activeAgent = agents.find((a) => a.id === activeSession?.agentId);

  const updateSession = useCallback(
    (id: string, updater: (s: ChatSession) => ChatSession) => {
      setSessions((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
    },
    []
  );

  const handleNewSession = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    const session: ChatSession = {
      id: generateId(),
      label: agent?.name ?? agentId,
      agentId,
      messages: [],
      created: Date.now(),
    };
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    setInput("");
    inputRef.current?.focus();
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) {
      setActiveId(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeSession || sending) return;
    const message = input.trim();
    setInput("");

    const userMsg: ChatMessage = {
      role: "user",
      content: message,
      timestamp: Date.now(),
    };

    updateSession(activeSession.id, (s) => ({
      ...s,
      messages: [...s.messages, userMsg],
    }));

    setSending(true);
    try {
      const result: AgentInvokeResult = await invokeAgent(
        activeSession.agentId,
        message,
        undefined,
        {
          conversation_id: activeSession.id,
          include_history: true,
        }
      );

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.response_text,
        timestamp: Date.now(),
        agent_name: result.agent_name,
        model: result.model,
        tokens: result.tokens,
        duration_ms: result.duration_ms,
        tool_results: result.tool_results,
        success: result.success,
      };

      updateSession(activeSession.id, (s) => ({
        ...s,
        messages: [...s.messages, assistantMsg],
      }));
    } catch (err) {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: `Error: ${(err as Error).message}`,
        timestamp: Date.now(),
        success: false,
      };
      updateSession(activeSession.id, (s) => ({
        ...s,
        messages: [...s.messages, errorMsg],
      }));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <NavBar title="Chat" />
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left: Session list */}
        <div className="w-64 shrink-0 border-r border-base-300 flex flex-col bg-base-100">
          {/* New session */}
          <div className="p-3 border-b border-base-300">
            <select
              className="select select-bordered select-sm w-full"
              value=""
              onChange={(e) => {
                if (e.target.value) handleNewSession(e.target.value);
              }}
            >
              <option value="" disabled>
                + New Chat...
              </option>
              {agents
                .filter((a) => a.has_connection)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Sessions */}
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 && (
              <p className="text-sm text-base-content/40 text-center py-6">
                No sessions yet
              </p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-base-200 group ${
                  activeId === s.id ? "bg-primary/10" : "hover:bg-base-200"
                }`}
                onClick={() => setActiveId(s.id)}
              >
                <FontAwesomeIcon
                  icon={faRobot}
                  className="text-primary shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.label}</div>
                  <div className="text-xs text-base-content/40">
                    {s.messages.length} messages
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-xs text-error opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(s.id);
                  }}
                  title="Delete session"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Chat area */}
        <div className="flex-1 flex flex-col bg-base-200">
          {!activeSession ? (
            <div className="flex-1 flex items-center justify-center text-base-content/40">
              <div className="text-center">
                <FontAwesomeIcon
                  icon={faRobot}
                  className="text-4xl mb-3 opacity-30"
                />
                <p>Select an agent and start chatting</p>
                <p className="text-xs mt-1">
                  Choose an agent from the dropdown to begin
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Agent info bar */}
              <div className="px-4 py-2 bg-base-100 border-b border-base-300 flex items-center gap-2 text-sm">
                <FontAwesomeIcon icon={faRobot} className="text-primary" />
                <span className="font-medium">{activeSession.label}</span>
                {activeAgent && (
                  <span className="text-xs text-base-content/50">
                    {activeAgent.description}
                  </span>
                )}
                <div className="flex-1" />
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    updateSession(activeSession.id, (s) => ({
                      ...s,
                      messages: [],
                    }));
                  }}
                  title="Clear messages"
                >
                  <FontAwesomeIcon icon={faTrash} /> Clear
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {activeSession.messages.length === 0 && (
                  <div className="text-center text-base-content/30 py-12">
                    <p>Send a message to start the conversation</p>
                  </div>
                )}
                {activeSession.messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                        <FontAwesomeIcon
                          icon={faRobot}
                          className="text-primary text-sm"
                        />
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] ${
                        msg.role === "user"
                          ? "bg-primary text-primary-content rounded-2xl rounded-tr-md px-4 py-2.5"
                          : "bg-base-100 rounded-2xl rounded-tl-md px-4 py-2.5 shadow-sm"
                      }`}
                    >
                      <div className="whitespace-pre-wrap text-sm">
                        {msg.content}
                      </div>
                      {/* Metadata for assistant messages */}
                      {msg.role === "assistant" && msg.model && (
                        <div className="mt-2 pt-2 border-t border-base-300/50 flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/40">
                          {msg.model && <span>{msg.model}</span>}
                          {msg.duration_ms != null && (
                            <span>{formatDuration(msg.duration_ms)}</span>
                          )}
                          {msg.tokens && <span>{formatTokens(msg.tokens)}</span>}
                          {msg.success === false && (
                            <span className="text-error font-medium">
                              Failed
                            </span>
                          )}
                          {msg.tool_results &&
                            msg.tool_results.length > 0 && (
                              <span>
                                <FontAwesomeIcon icon={faCircleInfo} />{" "}
                                {msg.tool_results.length} tool call
                                {msg.tool_results.length !== 1 ? "s" : ""}
                              </span>
                            )}
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                        <FontAwesomeIcon
                          icon={faUser}
                          className="text-primary-content text-sm"
                        />
                      </div>
                    )}
                  </div>
                ))}
                {sending && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <FontAwesomeIcon
                        icon={faRobot}
                        className="text-primary text-sm"
                      />
                    </div>
                    <div className="bg-base-100 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                      <FontAwesomeIcon
                        icon={faSpinner}
                        spin
                        className="text-primary"
                      />
                      <span className="ml-2 text-sm text-base-content/50">
                        Thinking...
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 bg-base-100 border-t border-base-300">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    className="textarea textarea-bordered flex-1 min-h-[44px] max-h-40 resize-none text-sm"
                    placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={sending}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                  >
                    <FontAwesomeIcon icon={faPaperPlane} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
