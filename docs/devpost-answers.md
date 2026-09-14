# Devpost answers (drafts)

## Name (≤60)

Bedtime Saga: a bedtime story that remembers

## Tagline (≤200)

An Alexa+ add-on (MCP server + MCP Apps) that continues your child's illustrated bedtime saga night after night, with parent guardrails enforced in code by Strands Agents hooks.

## Track / mini challenge

- Primary track: **Alexa+**
- Mini challenge: **AWS Builder** (Strands Agents SDK)
- Project status: **New**

## Built with

alexa-plus, model-context-protocol, mcp-apps, strands-agents, typescript, next.js, react, vercel, vercel-blob, oauth2, zod, web-speech-api, qwen, elevenlabs

## Description (markdown)

**Bedtime Saga** is an Alexa+ add-on that turns a child's smart display into a storyteller that remembers. It recaps last night's cliffhanger, tells one illustrated page at a time, and lets the child decide what happens next, by voice or with a tap. Every character the child invents and every chapter is saved, so tomorrow night picks up exactly where tonight ended.

### The problem
Bedtime reading builds language and connection, and it's disappearing: in a 2025 HarperCollins UK survey only 41% of parents of children 4 and under read to them frequently, down from 64% in 2012. Children read just one book a day hear about 290,000 more words by age 5 (Logan et al., 2019). Bedtime Saga is for tired parents of 3–8 year olds who still want those twenty cozy minutes.

### How it works
- **Self-hosted MCP server** (spec 2025-11-25, Streamable HTTP) with **8 tools** and structured output, **OAuth 2.1 + PKCE account linking** (the Alexa+ MCP Toolkit shape), 401/403 handling, and a private family profile in Vercel Blob.
- **MCP Apps storybook** (`ui://bedtime-saga/storybook.html`, built with `@modelcontextprotocol/ext-apps`): recap, page turns, choices, saga book and keepsake checkout. Taps return to the host as `ui/message`.
- **Illustrations without an image model:** a hand-authored layered SVG library composes every picture deterministically from story state.
- **Simulated Alexa+ smart display** (Alexa+ deployment is partner-only today): an MCP host using the official AppBridge, push-to-talk voice, spoken replies and a live feed of tool calls and guardrail decisions.
- **Strands Agents storyteller** with `McpClient` and **deterministic guardrails in hooks**: gentle themes (a request for "a scary monster that eats everyone" becomes a sleepy dragon), a nightly page limit that winds the chapter down, story-flow checks, privacy, a step cap, and **parent-only purchases** (the approval code comes only from the parent's tap).
- **Agent Skill** (`skills/bedtime-saga/SKILL.md`) documents how any agent should use the add-on.

### Business model
A "Saga Plus" family subscription plus printed keepsake books of the saga (checkout is simulated in the demo).

All people and stories in the demo are fictional. Built during the hackathon window with Claude Code as a coding assistant; narration by ElevenLabs.

## Existing project?

New (no update description needed).

## AWS Builder Mini Challenge: which AWS services and how

We used the **Strands Agents SDK (TypeScript, v1.17)** as the agent runtime for the Alexa+ storyteller (`lib/agent/saga-agent.ts`):
- `Agent` + `OpenAIModel` pointed at an OpenAI-compatible endpoint (Qwen3.8-27B). Strands' model-agnostic design means moving to Amazon Bedrock is a one-line provider swap.
- Strands `McpClient` connects the agent to our self-hosted MCP server over Streamable HTTP with the family's OAuth bearer token, so the agent can only act through the add-on's tools.
- Strands hooks carry the product's safety rules deterministically: `BeforeToolCallEvent` enforces gentle themes, the nightly page limit, story flow, privacy and parent-approved purchases (cancelling a call with a reason the model then follows); `BeforeModelCallEvent` caps steps; `AfterToolCallEvent` refreshes the family profile.
- We did not use paid AWS services (no Bedrock/AgentCore deployment) for this build.

## Open Source mini challenge

No (not entered).

## Feedback Q1: Which developer tools, APIs, and SDKs did you use and for what?

- **Alexa+ MCP Toolkit docs** (quickstart, account linking): shaped our server requirements (Streamable HTTP, OAuth 2.1 + PKCE, metadata endpoints, latency budget).
- **MCP TypeScript SDK** (`@modelcontextprotocol/sdk` 1.30): the MCP server (`McpServer`, `WebStandardStreamableHTTPServerTransport`) in a Next.js route.
- **MCP Apps** (`@modelcontextprotocol/ext-apps` 2.0): `registerAppTool`/`registerAppResource` on the server, `App` inside the storybook iframe, `AppBridge` + `PostMessageTransport` in our simulated Alexa+ host.
- **MCP client v2** (`@modelcontextprotocol/client`): the browser host connection used by AppBridge.
- **MCP Inspector CLI:** validating tools/list and resources/list against the authenticated server.
- **Strands Agents SDK (TypeScript):** the storyteller agent, `McpClient`, and hooks for guardrails.
- **Agent Skills spec:** `SKILL.md` for the add-on.
- Also: Next.js, Vercel + Vercel Blob (hosting and private profile storage), Web Speech API (voice in/out), ElevenLabs (video narration).

## Feedback Q2: What worked well?

- **Strands hooks:** `BeforeToolCallEvent` with `event.cancel = "reason"` is exactly the right primitive for product rules. The model reads the reason and self-corrects (it rewrote a scary request into a sleepy dragon without extra prompting).
- **Strands `McpClient`:** connected to an authenticated Streamable HTTP server with custom headers on the first try.
- **MCP SDK web-standard transport:** fits Next.js route handlers in stateless mode with no adapter, and negotiated `2025-11-25` out of the box.
- **MCP Apps `AppBridge` / `App`:** once wired, tool results and `ui/message` round-trips between the iframe and host just worked, and the sandbox model felt safe.
- **Alexa+ MCP Toolkit docs:** concrete, short requirements list (transport, auth, latency) that made the server design obvious.

## Feedback Q3: What needs work?

- **Alexa+ access:** add-on deployment is limited to select partners, and we found no public tester, so we couldn't validate against real Alexa+.
- **Auth guidance mismatch:** the quickstart's 401 / metadata guidance differs from what MCP 2025-11-25 clients expect (`WWW-Authenticate` + RFC 9728); we served both and couldn't confirm Alexa+ tolerates the header.
- **Strands TS `McpTool` drops `structuredContent` and `_meta`** from MCP tool results, so a Strands-driven host can't render MCP Apps without subclassing `McpClient.callTool`.
- **MCP Apps packaging:** no IIFE/UMD build for single-file `ui://` resources (the bundle ends in an ESM export block), `package.json` isn't exported, and ext-apps 2.0 is typed against the v2 split SDK packages while Strands uses SDK 1.x, which needed casts (and `description` isn't accepted in the resource config type).
- **MCP Inspector CLI via npx:** passing the bearer token as `--header` gets echoed by npm's `notice run` log; an env-var option would help.
Details with steps and workarounds: `FRICTION_LOG.md`.

## Feedback Q4: How was onboarding (zero to hello world)?

- **MCP server:** fast, under an hour to a working Streamable HTTP server in a Next.js route.
- **Strands Agents TS:** quick for a basic agent with an OpenAI-compatible model and hooks (about 15 minutes); connecting the MCP client was easy.
- **MCP Apps:** the concepts are well explained, but going from the Vite-based examples to a self-contained resource plus a custom host took a few hours (vendoring the bundle, reading the basic-host example source for AppBridge wiring).
- **Alexa+:** reading the docs was quick, but "hello world on a real device" wasn't possible without partner access.

## Feedback Q5: Would you build with these devices and services again?

Yes. MCP plus MCP Apps is a clean way to ship a rich, voice-first experience without building a separate Alexa-specific stack, and Strands hooks made the safety rules for a children's product enforceable in code. We'd build again as soon as Alexa+ add-on access opens more broadly; a public add-on tester would make the experience much better.

## [Optional] Feature requests

1. **Public Alexa+ add-on tester** for any Streamable HTTP MCP server, including account linking and MCP Apps rendering. Lets non-partners validate before applying. **Critical.**
2. **Strands: preserve MCP `structuredContent` / `_meta`** on tool results (or expose the raw result on `AfterToolCallEvent`) and first-class MCP Apps host support. **Important.**
3. **ext-apps IIFE build + single-file example** for `ui://` resources without a bundler. **Important.**
4. **One reference server that satisfies both the Alexa+ Toolkit auth flow and MCP 2025-11-25 authorization discovery.** **Important.**
5. **Parental controls hooks in Alexa+ for kids' add-ons** (age band, purchase approval handoff to a parent's phone) exposed to add-on developers. **Nice-to-have.**

## [Optional] Friction log

`FRICTION_LOG.md` in the repo (link once the repo is public).

## [Optional] Project testing link

https://bedtime-saga.vercel.app

## Testing instructions (for the description / judges)

1. Open https://bedtime-saga.vercel.app → **Link account** → **Allow and link** (OAuth 2.1 + PKCE; no sign-up, a demo family is created).
2. Type or say (mic button, Chrome) **"Let's continue my saga!"** The storybook card shows the recap, a new illustrated page and choices. The right panel shows each MCP tool call and guardrail verdict.
3. Tap a choice on the card (sent to the host as `ui/message`).
4. Ask **"Can we add a scary monster that eats everyone?"** → the request guardrail blocks it and the story continues with a sleepy dragon; at 3 pages the chapter ends.
5. **"Open the saga book"**, then **"Can we order a printed keepsake book?"** → tap **Parent: confirm order** (simulated payment).
6. **Reset demo** restores night 2. Rate limit: 20 turns per IP per 10 minutes.
7. MCP server for your own client: `https://bedtime-saga.vercel.app/api/mcp` (OAuth metadata at `/.well-known/oauth-authorization-server`).
