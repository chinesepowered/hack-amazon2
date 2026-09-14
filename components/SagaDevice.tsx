"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { AppBridge, PostMessageTransport, getToolUiResourceUri } from "@modelcontextprotocol/ext-apps/app-bridge";

// Simulated Alexa+ smart display. It is an MCP host: it connects to the Bedtime Saga MCP server
// (Streamable HTTP + OAuth bearer), renders the MCP App UI resource in a sandboxed iframe through the
// official AppBridge, forwards ui/message back to the assistant, and shows what the Strands agent does.

const STORYBOOK_URI = "ui://bedtime-saga/storybook.html";

type EvKind = "user" | "tool" | "pass" | "block" | "say" | "err" | "done";
type Ev = { id: number; kind: EvKind; title: string; detail?: string; ms?: string; pending?: boolean };
type Profile = {
  familyName: string;
  child: string;
  night: number;
  pagesTonight: number;
  chapters: number;
  settings: { ageBand: string; pagesPerNight: number; gentleThemesOnly: boolean; keepsakeNeedsParent: boolean };
  subscription: { plan: string; status: string };
  storage: string;
};
type Host = { client: Client; bridge: AppBridge; uiTools: Set<string> };

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function summarize(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "tell_story_page":
      return `“${String(input.text ?? "").slice(0, 70)}…” · ${input.scene}`;
    case "offer_choices":
      return ((input.choices as { label: string }[]) ?? []).map((c) => c.label).join(" · ");
    case "add_character":
      return `${input.name} the ${input.kind}`;
    case "end_chapter":
      return `“${input.title}”`;
    case "confirm_keepsake_order":
      return "approval code from parent's tap";
    default:
      return "";
  }
}

const LABEL: Record<string, string> = {
  get_saga_recap: "get_saga_recap",
  tell_story_page: "tell_story_page",
  offer_choices: "offer_choices",
  add_character: "add_character",
  end_chapter: "end_chapter",
  open_saga_book: "open_saga_book",
  preview_keepsake_book: "preview_keepsake_book",
  confirm_keepsake_order: "confirm_keepsake_order",
};

export default function SagaDevice() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [input, setInput] = useState("");
  const [said, setSaid] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [turnMeta, setTurnMeta] = useState("");

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hostRef = useRef<Host | null>(null);
  const connectingRef = useRef(false);
  const idRef = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const sendRef = useRef<(text: string) => void>(() => {});

  const push = useCallback((e: Omit<Ev, "id">) => {
    const id = ++idRef.current;
    setEvents((prev) => [...prev.slice(-60), { ...e, id }]);
    return id;
  }, []);
  const patch = useCallback((id: number, p: Partial<Ev>) => setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...p } : e))), []);

  useEffect(() => {
    setToken(localStorage.getItem("saga_token"));
    setReady(true);
  }, []);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  const loadProfile = useCallback(async (t: string) => {
    const r = await fetch("/api/family", { headers: { Authorization: `Bearer ${t}` } });
    if (r.status === 401) {
      localStorage.removeItem("saga_token");
      setToken(null);
      return;
    }
    if (r.ok) setProfile(await r.json());
  }, []);

  // Connect the MCP host + AppBridge once we have a linked account.
  useEffect(() => {
    if (!token || connectingRef.current) return;
    connectingRef.current = true;
    (async () => {
      try {
        await loadProfile(token);
        const client = new Client({ name: "alexa-plus-simulator", version: "1.0.0" });
        await client.connect(
          new StreamableHTTPClientTransport(new URL("/api/mcp", window.location.origin), {
            requestInit: { headers: { Authorization: `Bearer ${token}` } },
          }),
        );
        const { tools } = await client.listTools();
        const uiTools = new Set(tools.filter((t) => getToolUiResourceUri(t)).map((t) => t.name));
        const res = await client.readResource({ uri: STORYBOOK_URI });
        const html = (res.contents[0] as { text?: string }).text ?? "";
        const iframe = iframeRef.current!;
        const bridge = new AppBridge(
          client,
          { name: "Alexa+ simulator (Bedtime Saga demo)", version: "1.0.0" },
          { openLinks: {}, serverTools: {}, serverResources: {}, message: { text: {} }, logging: {} },
          {
            hostContext: {
              theme: "dark",
              platform: "web",
              locale: "en-US",
              displayMode: "inline",
              availableDisplayModes: ["inline"],
              containerDimensions: { width: iframe.clientWidth, height: iframe.clientHeight },
            },
          },
        );
        bridge.onmessage = async (params) => {
          const text = (params.content ?? [])
            .map((c) => (c.type === "text" ? c.text : ""))
            .join(" ")
            .trim();
          if (text) sendRef.current(text);
          return {};
        };
        bridge.onloggingmessage = () => {};
        bridge.onsizechange = async () => {};
        const initialized = new Promise<void>((resolve) => {
          bridge.oninitialized = () => resolve();
        });
        await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
        iframe.srcdoc = html;
        await Promise.race([initialized, new Promise((r) => setTimeout(r, 10000))]);
        hostRef.current = { client, bridge, uiTools };
        push({ kind: "pass", title: "MCP host connected", detail: `${tools.length} tools · MCP App ${STORYBOOK_URI}` });
      } catch (err) {
        connectingRef.current = false;
        push({ kind: "err", title: "Could not connect to the add-on", detail: String(err) });
      }
    })();
  }, [token, loadProfile, push]);

  const send = useCallback(
    async (text: string) => {
      const t = localStorage.getItem("saga_token");
      if (!t || !text.trim()) return;
      setBusy(true);
      setSaid(text);
      setReply("");
      setInput("");
      push({ kind: "user", title: text.startsWith("Parent confirmed") ? "Parent tapped Confirm (ui/message)" : text.startsWith("I choose:") ? "Tapped a choice (ui/message)" : "Heard", detail: text.replace(/Approval code: \S+/, "Approval code: ••••••") });
      const host = hostRef.current;
      const pendingRows: { name: string; id: number }[] = [];
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${t}` },
          body: JSON.stringify({ utterance: text }),
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          push({ kind: "err", title: "Assistant unavailable", detail: j.error ?? res.statusText });
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const e = JSON.parse(line);
            if (e.type === "tool_call") {
              const id = push({ kind: "tool", title: LABEL[e.name] ?? e.name, detail: summarize(e.name, e.input ?? {}), pending: true });
              pendingRows.push({ name: e.name, id });
              if (host?.uiTools.has(e.name)) {
                void host.bridge.sendToolInput({ arguments: e.input ?? {}, _meta: { toolName: e.name } } as Parameters<AppBridge["sendToolInput"]>[0]);
              }
            } else if (e.type === "hook") {
              push({ kind: e.ok ? "pass" : "block", title: `Guardrail ${e.ok ? "passed" : "blocked"} · ${e.rule}`, detail: e.detail });
              if (!e.ok) {
                const idx = pendingRows.findIndex((r) => r.name === e.tool);
                if (idx >= 0) {
                  patch(pendingRows[idx].id, { pending: false, ms: "blocked" });
                  pendingRows.splice(idx, 1);
                }
              }
            } else if (e.type === "tool_result") {
              const idx = pendingRows.findIndex((r) => r.name === e.name);
              if (idx >= 0) {
                patch(pendingRows[idx].id, { pending: false, ms: `${e.ms} ms`, ...(e.isError ? { kind: "err" as const, detail: e.text } : {}) });
                pendingRows.splice(idx, 1);
              }
              if (host?.uiTools.has(e.name)) {
                void host.bridge.sendToolResult({ content: [{ type: "text", text: e.text }], structuredContent: e.structuredContent, isError: e.isError } as Parameters<AppBridge["sendToolResult"]>[0]);
              }
            } else if (e.type === "say") {
              setReply(e.text);
              try {
                window.speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(e.text);
                u.rate = 0.95;
                u.pitch = 1.05;
                window.speechSynthesis.speak(u);
              } catch {}
            } else if (e.type === "error") {
              push({ kind: "err", title: "Agent error", detail: e.message });
            } else if (e.type === "done") {
              setTurnMeta(`${e.modelCalls} model calls · ${(e.ms / 1000).toFixed(1)} s`);
            }
          }
        }
      } catch (err) {
        push({ kind: "err", title: "Network error", detail: String(err) });
      } finally {
        pendingRows.forEach((r) => patch(r.id, { pending: false }));
        setBusy(false);
        void loadProfile(t);
      }
    },
    [push, patch, loadProfile],
  );
  sendRef.current = send;

  const startLink = async () => {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
    sessionStorage.setItem("saga_pkce_verifier", verifier);
    sessionStorage.setItem("saga_pkce_state", state);
    const u = new URL("/oauth/authorize", window.location.origin);
    u.search = new URLSearchParams({
      response_type: "code",
      client_id: "alexa-plus-simulator",
      redirect_uri: `${window.location.origin}/link/callback`,
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: `${window.location.origin}/api/mcp`,
      scope: "saga",
      state,
    }).toString();
    window.location.href = u.toString();
  };

  const resetDemo = async () => {
    const t = localStorage.getItem("saga_token");
    if (!t) return;
    await fetch("/api/family", { method: "POST", headers: { Authorization: `Bearer ${t}` } });
    window.location.reload();
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      push({ kind: "err", title: "Voice input unavailable", detail: "This browser has no Web Speech API. Type instead." });
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.onresult = (ev) => {
      const results = Array.from(ev.results);
      const text = results.map((r) => r[0].transcript).join("");
      setInput(text);
      if (results.at(-1)?.isFinal) void send(text);
    };
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  };

  const s = profile?.settings;
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
            <circle cx="22" cy="22" r="21" fill="#1d2150" stroke="#ffffff22" />
            <path d="M27 9a11 11 0 1 0 8 17A9 9 0 0 1 27 9z" fill="#fff4dc" />
            <path d="M9 31c4-2 8-2 13 0 5-2 9-2 13 0v4c-4-2-8-2-13 0-5-2-9-2-13 0z" fill="#ffb54c" />
          </svg>
          <div>
            <h1 className="serif">Bedtime Saga</h1>
            <small>An Alexa+ add-on · simulated smart display</small>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span className="pill">
            <span className="dot" />
            MCP 2025-11-25 · Streamable HTTP
          </span>
          <span className="pill">MCP Apps</span>
          <span className="pill">Strands Agents SDK</span>
        </div>
      </header>

      <section className="stage">
        <div className="device">
          <div className="screen">
            <iframe ref={iframeRef} sandbox="allow-scripts" title="Bedtime Saga MCP App" data-testid="app-frame" />
            {ready && !token && (
              <div className="linkcard">
                <div className="box">
                  <h2 className="serif">Link Bedtime Saga</h2>
                  <p>Continue your child&apos;s bedtime story night after night. Linking uses OAuth 2.1 with PKCE, like an Alexa+ add-on. No sign-up: a demo family is created for you.</p>
                  <button className="btn" onClick={startLink} data-testid="link-button">
                    Link account
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="device-foot">
            <div className="caption" data-testid="caption">
              <div className="said">{said ? `“${said.replace(/Approval code: \S+/, "Approval code: ••••••")}”` : "Try: “Let's continue my saga!”"}</div>
              <div className="reply">{reply || (busy ? "…" : "")}</div>
            </div>
          </div>
          <div className={`lightbar ${busy ? "on" : ""}`} />
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <button type="button" className={`mic ${listening ? "listening" : ""}`} onClick={toggleMic} aria-label="Push to talk" disabled={!token}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={token ? "Say something to Saga…" : "Link the account first"} data-testid="agent-input" disabled={!token} />
          <button className="send" type="submit" disabled={busy || !input.trim() || !token} data-testid="send">
            Send
          </button>
        </form>
      </section>

      <aside className="side">
        <div className="card">
          <h3>
            Linked account
            {token && (
              <button className="btn ghost" onClick={resetDemo} data-testid="reset">
                Reset demo
              </button>
            )}
          </h3>
          {profile ? (
            <dl className="kv">
              <dt>Family</dt>
              <dd>{profile.familyName}</dd>
              <dt>Child</dt>
              <dd>{profile.child}</dd>
              <dt>Tonight</dt>
              <dd data-testid="tonight">
                Night {profile.night} · page {profile.pagesTonight}/{profile.settings.pagesPerNight}
              </dd>
              <dt>Saga book</dt>
              <dd>{profile.chapters} chapter{profile.chapters === 1 ? "" : "s"}</dd>
              <dt>Plan</dt>
              <dd>{profile.subscription.plan}</dd>
              <dt>Auth</dt>
              <dd>OAuth 2.1 + PKCE</dd>
              <dt>Profile store</dt>
              <dd>{profile.storage}</dd>
            </dl>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 14 }}>{token ? "Loading…" : "Not linked yet"}</div>
          )}
        </div>
        <div className="card">
          <h3>
            Parent guardrails <span className="mono" style={{ letterSpacing: 0, textTransform: "none" }}>Strands hooks</span>
          </h3>
          <div className="chips">
            <span className="chip">Ages {s?.ageBand ?? "3-5"}</span>
            <span className="chip">{s?.gentleThemesOnly === false ? "All themes" : "Gentle themes only"}</span>
            <span className="chip">{s?.pagesPerNight ?? 3} pages per night</span>
            <span className="chip">{s?.keepsakeNeedsParent === false ? "Kids can order" : "Parent approves purchases"}</span>
          </div>
        </div>
        <div className="card feed">
          <h3>
            Under the hood <span style={{ letterSpacing: 0, textTransform: "none" }}>{turnMeta}</span>
          </h3>
          <div className="feed-list" ref={feedRef} data-testid="activity">
            {events.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13.5 }}>MCP tool calls and guardrail decisions appear here.</div>}
            {events.map((e) => (
              <div key={e.id} className={`ev ${e.kind}`} data-testid={`ev-${e.kind}`}>
                <span className="ic">{{ user: "“", tool: e.pending ? "…" : "⚙", pass: "✓", block: "✕", say: "♪", err: "!", done: "·" }[e.kind]}</span>
                <div style={{ minWidth: 0 }}>
                  <div className={`t ${e.kind === "tool" ? "mono" : ""}`}>{e.title}</div>
                  {e.detail && <div className="d">{e.detail}</div>}
                </div>
                <span className="ms">{e.ms ?? ""}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  onresult: (ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};
