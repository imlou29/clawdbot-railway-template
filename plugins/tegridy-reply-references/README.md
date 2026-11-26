# Tegridy Telegram reply references

This pilot covers one Telegram forum topic. It only reuses a confirmed final text reply
to the same normalized question. References expire after 30 minutes. Routing, model
generation, and normal delivery continue on a cache miss.

The plugin records a provider message ID only after a successful delivery receipt
matches the incoming session, account, run ID, and final text. The cache stores question
hashes, source digests, and Telegram message IDs. Telegram delivery paths that omit
correlation fields remain cache misses.

## Staging configuration

Load this local plugin using OpenClaw's plugin loader. The plugin ID is
`tegridy-reply-references`. Set its entry config as follows, replacing the example
session key with the exact staging forum topic key.

```json
{
  "sessionKey": "agent:main:telegram:group:-1001234567890:topic:85",
  "directory": "/data/tegridy-reply-references",
  "revisionFiles": [
    "/data/workspace/knowledge_base.json",
    "/data/workspace/announcements.revision"
  ]
}
```

Use a test Telegram bot and an isolated test topic for a live pilot. Point `revisionFiles`
at the sources governing answer freshness. The example includes both the knowledge base
and an announcement revision file. Update the latter when a relevant official
announcement is published, changed, or withdrawn outside the knowledge base. A missing
revision file disables reuse. Use a writable persistent directory for the cache.

Verify a known answer, a duplicate, an admin referral, and an answer after a source
revision changes. Confirm that the duplicate points to the original Telegram reply and
that the reference is itself a reply to the new question. A legacy delivery without the
required receipt will keep using normal generation.
