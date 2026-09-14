---
name: bedtime-saga
description: Continue a child's personal bedtime story night after night using the Bedtime Saga MCP server. Use when a child or parent asks to hear, continue or shape their bedtime saga, add a character, see the saga book, or order a printed keepsake book.
license: TBD
compatibility: Requires an MCP client that supports Streamable HTTP (MCP 2025-11-25) and OAuth 2.1 account linking. MCP Apps UI support is recommended for the illustrated storybook.
metadata:
  mcp-server: https://<your-deployment>/api/mcp
  ui-resource: ui://bedtime-saga/storybook.html
---

# Bedtime Saga

Bedtime Saga is a continuing, illustrated bedtime story that remembers the child's world: the characters they invented, where the story stopped, and their favorite things. Every tool call updates the family's private profile, so the next night picks up exactly where this one ended.

## Before you start

- The account must be linked (OAuth 2.1, authorization code + PKCE S256). Unauthenticated calls return 401; discover auth at `/.well-known/oauth-authorization-server` or `/.well-known/oauth-protected-resource`.
- Every tool declares `_meta.ui.resourceUri = ui://bedtime-saga/storybook.html`. If your host renders MCP Apps, show that resource and forward tool results to it.

## Nightly flow

1. **Open the night:** call `get_saga_recap` first. It returns the cast, favorites, last chapter summary and cliffhanger, and how many pages tonight allows.
2. **Tell one page at a time:** call `tell_story_page` with 2–3 gentle sentences, a `scene`, the exact cast `characters` on the page, up to 2 `props`, `timeOfDay` and `mood`. The server illustrates it.
3. **Let the child decide:** call `offer_choices` with 2–3 short choices. Wait for the child's answer (spoken, or a `ui/message` like `I choose: …` from the card).
4. **Build on the answer:** `tell_story_page` again, then `offer_choices`. Never offer choices twice for the same page.
5. **Wind down:** when the page limit is reached, call `end_chapter` with a title, summary, gentle cliffhanger and a soft goodnight line.

## Other requests

- New character invented by the child: `add_character` (kind is one of child, fox, hedgehog, owl, turtle, whale, bunny, dragon, bear, cat, mouse, robot), then use them in the next page.
- "Show my saga book": `open_saga_book`.
- "Order a printed book": `preview_keepsake_book`. Only a parent can confirm: the order card sends a `ui/message` containing an approval code. Call `confirm_keepsake_order` with that exact code. Never invent or guess the code.

## Guardrails (enforced by the server, do not work around them)

- Gentle themes only for young children: no monsters, violence, fear or "sad forever" endings. If the child asks for something scary, keep it cozy by swapping in a friendly version (for example a sleepy dragon) and say the story stays cozy at bedtime.
- Bedtime length: tonight's page limit is set by the parent. When a tool reports `bedtime-limit`, end the chapter.
- Privacy: never put contact details or addresses in story text. The child's data stays in the family profile.
- A tool error that starts with `Guardrail` explains what to change. Follow it and try again.

## Voice style

Speak one or two warm sentences after the tools run. Do not read the page text twice; the card shows it.
