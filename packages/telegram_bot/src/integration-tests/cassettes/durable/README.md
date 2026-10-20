# Native Durable recordings

Record behavioral scenarios with `pnpm test:integration:agent-loop:record` from the repository root.
Recording calls the configured real provider and incurs API charges. Set `LLM_MODEL` and its provider credentials.

New recordings live here under a provider/model namespace. The cassette envelope remains version 1 for compatibility with the existing manager.
Each response contains `format: "pi-durable-assistant-v1"` and the complete native assistant message, including tool calls and arguments.

Legacy recordings remain unchanged in the parent directory's model folders. They use the removed text protocol and cannot replay native tool behavior.
Do not convert them into fabricated native responses. Create fresh recordings using the adapted Harness scenarios.

Playback fails on missing/mismatched recordings, unconsumed interactions, and non-native responses. It never resolves real model credentials or invokes the source provider.
CI always tests the VCR boundary and Durable recovery. Recorded behavioral playback starts automatically when native JSON cassettes exist here.
