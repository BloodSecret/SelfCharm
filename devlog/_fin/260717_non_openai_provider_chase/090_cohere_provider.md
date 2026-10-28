# WP9 — Cohere compatibility provider

## Goal and dependency

Add Cohere through its official OpenAI Compatibility API without importing Cohere-native SDK abstractions.

## Diff map

| Action | Path | Before | After |
|---|---|---|---|
| MODIFY | `src/providers/registry/entries-extended.ts`, `src/providers/free-directory.ts` | no Cohere preset or matching directory row | keyed `openai-chat` preset and matching official Compatibility API endpoint `https://api.cohere.ai/compatibility/v1` |
| MODIFY | `tests/provider-registry-parity.test.ts` | no Cohere derivation | assert registry→key login→management preset parity |
| NEW | `tests/cohere-provider.test.ts` | no compatibility fixture | stream text/tools, usage, tool-choice behavior, auth redaction, and parameter support |
| MODIFY | `README.md`, `README.ko.md`, `README.zh-CN.md`, `docs/README.md` | no Cohere | advertise only capabilities proven by compatibility fixtures |

## Contract details

- Initial static seed is `command-a-plus-05-2026` (128,000 context; 64,000 max output), verified against Cohere model docs on 2026-10-28.
- Cohere-native citations, rerank, connectors, and RAG parameters are out. This phase owns Chat Completions compatibility only.
- Do not claim Responses API support.
- Official Compatibility API docs list only `none`/`high` for `reasoning_effort` and explicitly exclude `parallel_tool_calls`. The preset disables parallel calls and omits `stream_options`, which is not in the documented supported-parameter list. The shared adapter change is behind the new provider config flag `omitChatStreamOptions`, so other providers retain existing behavior.
- `liveModels: false` and `apiKeyValidation: "unknown"` are intentionally conservative until model-list filtering and authenticated key-validation contracts are fixture-tested.

## Activation scenarios

- Standard text stream terminates cleanly and usage maps to OCX totals.
- A function call round trip preserves tool id/name/JSON arguments and tool result role.
- An unsupported parameter fixture proves the exact field removed; unrelated providers retain it.
- A model-list failure falls back to the audited seed without inventing capabilities.

## Verification

```bash
bun test tests/cohere-provider.test.ts tests/provider-registry-parity.test.ts tests/openai-chat-parallel-stream.test.ts
bun run typecheck
```

## Terminal outcomes

- `DONE`: official current model seed, compatibility fixtures, and authenticated smoke pass.
- `NOOP`: current custom-provider flow is chosen intentionally and a first-class preset has no product value; requires user approval.
- `NEEDS_HUMAN`: no Cohere API key.
- `BLOCKED`: compatibility API lacks the tool/stream behavior required by Codex.


## Implementation follow-up — 2026-10-28

Implementation was pushed to `BloodSecret/SelfCharm:work/providers`. Files include the registry preset, adapter option omission, config-policy/model-rename classification, provider regression test and test-layout oracle, README and public provider docs. No live API call was made. Local post-change verification exposed three integration failures: missing exhaustive config-policy classifications for `omitChatStreamOptions`, a free-directory/registry endpoint mismatch (`.com` vs official docs `.ai`), and this structure SSOT document exceeding the 600-line cap after an inline addition. The first two are fixed in follow-up commits; the inline structure paragraph is removed and retained in this devlog to restore the line budget. Re-run targeted tests, typecheck and structure checks before treating the implementation as verified. Usage accounting for streamed Cohere responses still needs confirmation without `stream_options.include_usage`.
