---
id: providers
title: Model providers and Countersign AI
summary: Countersign AI is auto-provisioned after sign-in for pay-per-token model access; manage it (and custom providers) in Settings > Model Providers.
tab: providers
---
Claude Code, Codex, and lightweight utility models can use **Countersign AI** for pay-per-token model access. Voice input is included for signed-in Countersign users and uses the separate voice service; it does not require or receive a Countersign AI key.

**Countersign AI:**

- Open **Settings > Model Providers** (the tab is labeled "Providers"). Countersign AI is pinned at the top.
- You don't paste a key — it's **provisioned automatically after you sign in**. The page fetches its credentials for you ("Fetching credentials…" while it does).
- Controls: **Refresh credentials**, **Rotate key**, and **Disconnect** (which clears the Countersign AI key saved locally). Because it's tied to your account, it's available on each device you sign into.

**Status badges:**

- **Connected** — this device has usable Countersign AI credentials.
- If it's still fetching or disconnected, use Refresh credentials / sign in.

**Custom providers:**

- You can also add your own provider (a base URL + key) — that's the flow with a paste-a-key dialog. Countersign AI itself never uses that dialog.

**Notes:**

- Direct service keys such as Brave Search, Tavily, and DeepSeek search are **not** managed here — they live on the matching plugin detail pages under Plugins (Countersign Web Search). They are optional; web search works through Countersign AI without them.
- Rotating or replacing credentials takes effect for new turns; in-flight requests finish on the previous key.
