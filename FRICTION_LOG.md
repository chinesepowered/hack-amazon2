# Friction log

Real friction we hit while building Bedtime Saga (Sep 14 2026) with the Alexa+ MCP Toolkit docs, the MCP TypeScript SDKs, MCP Apps (`@modelcontextprotocol/ext-apps` 2.0.0), MCP Inspector and the Strands Agents TypeScript SDK (1.17.0). Each entry lists what we tried, what happened, and what would have helped.

Severity scale: **High** = blocked a core requirement, **Medium** = cost real time or needed a workaround in code, **Low** = annoyance.

---

## 1. No way to test a self-hosted MCP server against real Alexa+

- **Task:** Run our Bedtime Saga MCP server inside Alexa+ to validate account linking, MCP Apps rendering and voice behavior.
- **Steps:** Read the Alexa+ add-ons docs home, the MCP Toolkit overview and the quickstart; looked for a public simulator or developer test mode.
- **Expected:** A way for any developer to connect a server URL to an Alexa+ test surface (even text-only) and see tool calls.
- **Actual:** The docs state Alexa+ add-ons are available to select partners only. We found no public simulator for MCP-based add-ons.
- **Severity:** High (for anyone outside the partner program).
- **Workaround:** Built our own simulated smart-display host (MCP client + AppBridge + Web Speech) so we could demonstrate the full flow.
- **Suggestion:** Publish a sandbox "Alexa+ add-on tester" (web) that connects to any Streamable HTTP MCP server, runs the account-linking flow and renders MCP Apps, even if it is not the production model.

## 2. Alexa+ MCP Toolkit auth guidance differs from what MCP 2025-11-25 clients expect

- **Task:** Implement account linking that works for Alexa+ and for standard MCP clients (MCP Inspector, our own host).
- **Steps:** Followed the quickstart's OAuth section, then the MCP 2025-11-25 authorization spec.
- **Expected:** One consistent discovery flow.
- **Actual:** As we read the quickstart, it asks for a plain 401 (it lists `WWW-Authenticate` in 401 responses as not yet supported) and for metadata at `/.well-known/oauth-authorization-server`, while MCP 2025-11-25 clients discover auth through `WWW-Authenticate: Bearer resource_metadata=…` and RFC 9728 protected-resource metadata. It was unclear whether sending the header would break Alexa+ discovery.
- **Severity:** Medium.
- **Workaround:** Serve both `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`, and include `WWW-Authenticate` on 401 (`app/api/mcp/route.ts`, `app/api/oauth-metadata/route.ts`).
- **Suggestion:** State explicitly whether Alexa+ tolerates (ignores) `WWW-Authenticate` and RFC 9728 metadata, and add a sample server that satisfies both Alexa+ and the MCP spec at once.

## 3. MCP Apps: no drop-in browser build for self-contained `ui://` resources

- **Task:** Serve the storybook UI as a single self-contained HTML resource (no bundler for the iframe) using the official `App` class.
- **Steps:** Looked for an IIFE/UMD build in `@modelcontextprotocol/ext-apps`; found `dist/src/app-with-deps.js` (~410 KB).
- **Expected:** A file that can be inlined in a `<script>` tag, or documented guidance for inlining.
- **Actual:** The bundle ends with an ES module `export {…}` block, so it can't run as a classic inline script, and the examples assume a Vite build step.
- **Severity:** Medium.
- **Workaround:** `scripts/vendor-ext-apps.mjs` rewrites the trailing export block into a `globalThis.ExtApps` object at build time and inlines it into the resource HTML.
- **Suggestion:** Ship an IIFE build (e.g. `dist/ext-apps.global.js`) and a "single-file MCP App without a bundler" example.

## 4. `@modelcontextprotocol/ext-apps/package.json` is not exported

- **Task:** Locate the package directory from a Node script (`require.resolve("@modelcontextprotocol/ext-apps/package.json")`).
- **Actual:** `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- **Severity:** Low.
- **Workaround:** Build the path from `node_modules` directly.
- **Suggestion:** Add `"./package.json": "./package.json"` to `exports`.

## 5. Two generations of the MCP TypeScript SDK in one app

- **Task:** Register MCP App tools on an `McpServer` while also using the Strands `McpClient`.
- **Steps:** Installed `@modelcontextprotocol/sdk` 1.30.0 (what Strands TS depends on) and `@modelcontextprotocol/ext-apps` 2.0.0.
- **Expected:** `registerAppTool(server, …)` and `registerAppResource(server, …)` accept the SDK's `McpServer`.
- **Actual:** ext-apps 2.0.0 is typed against the v2 split packages (`@modelcontextprotocol/server`, `client`, `core`) as peer dependencies. With the 1.x `McpServer` we needed type casts, and `McpUiAppResourceConfig` rejected a `description` field (`TS2353: 'description' does not exist`). The browser `AppBridge` then needed the v2 `@modelcontextprotocol/client` installed as well.
- **Severity:** Medium.
- **Workaround:** Casts in `lib/mcp/server.ts`; installed both SDK generations.
- **Suggestion:** Document the supported SDK combinations for MCP Apps + Strands, and accept 1.x `McpServer` in the helper types (it only calls `registerTool`/`registerResource`).

## 6. Strands TS `McpTool` drops `structuredContent` and `_meta` from tool results

- **Task:** Let the Strands agent call MCP tools and have the host render the MCP App with the tool's `structuredContent` (MCP Apps pass the full `CallToolResult` to the view).
- **Steps:** Used `new Agent({ tools: [mcpClient] })` and looked for the raw result in `AfterToolCallEvent`.
- **Expected:** Access to the original `CallToolResult` (including `structuredContent` and `_meta`).
- **Actual:** `McpTool.stream()` maps only the `content` array into a `ToolResultBlock` (see `dist/src/tools/mcp-tool.js`), so `structuredContent` is not available to hooks or the caller.
- **Severity:** Medium (blocks MCP Apps hosts built on Strands).
- **Workaround:** Subclassed `McpClient` and overrode `callTool()` to report the raw result (`ObservedMcpClient` in `lib/agent/saga-agent.ts`).
- **Suggestion:** Preserve `structuredContent` and `_meta` on the tool result (or expose the raw result on `AfterToolCallEvent`), and add first-class MCP Apps support to the Strands MCP client.

## 7. Bearer token echoed in logs when using MCP Inspector CLI through npx

- **Task:** Validate the authenticated MCP server with `npx @modelcontextprotocol/inspector --cli <url> --transport http --header "Authorization: Bearer …"`.
- **Actual:** The run worked (8 tools listed with UI metadata), but npm's `notice run` line echoed the full command, including the bearer token, to the terminal.
- **Severity:** Low (security hygiene; tokens end up in terminal and CI logs).
- **Workaround:** Used a short-lived local token only.
- **Suggestion:** Let the Inspector CLI read headers from an environment variable or file (e.g. `--header-env AUTHORIZATION`), and mention the log-echo risk in the docs.

---

## What worked well (for balance)

- **Strands hooks:** setting `event.cancel = "reason"` in `BeforeToolCallEvent` blocks a call and gives the model the reason, so it self-corrects (it rewrote a page and swapped a scary monster for a sleepy dragon without extra prompting).
- **Strands `McpClient` over Streamable HTTP** with custom headers connected to our authenticated server on the first try.
- **MCP SDK `WebStandardStreamableHTTPServerTransport`** fits Next.js route handlers directly in stateless mode, and negotiated protocol `2025-11-25`.
- **`AppBridge` + `App`:** once connected, `ui/message` from a button in the iframe to the host "just worked".
