---
name: tegridy-coa-lookup
description: "Find Tegridy COA links from the live Peptegridy COA page. Use for ordinary member questions about COA links, posted COAs, purity, quantity, batch COAs, or where to view a COA."
---

# Tegridy Live COA Lookup

Use the live public COA catalog at:

https://www.peptegridy.com/coas

The live COA page is the primary source for locating currently published COA links.

## Required GB Disambiguation

Before running any live COA lookup, determine whether the user explicitly identified the Group Buy.

Examples of acceptable GB identification include:
- June / June 26 GB
- Lobster / Lobster GB
- YuanTai / YuanTai GB

If the user did NOT identify the GB:
- do NOT run the lookup helper
- do NOT infer the GB from product, mg, cap color, batch, prior behavior, or likely match
- ask one short follow-up: which GB are you looking for?

Example:
"Which GB are you looking for — June, Lobster, or YuanTai?"

Once the user supplies the GB, continue using the product from the immediately preceding COA request.

## Running the Lookup

Use:

node /data/workspace/skills/tegridy-coa-lookup/scripts/coa-lookup.mjs --query "<product>" --group-buy "<GB>"

Do not use --no-cache for normal user requests. The helper uses a 120-second cache while keeping the live website as the source.

The helper returns JSON with status:
- found
- multiple
- not_found
- needs_group_buy
- error

## Response Rules

For status "found":
- return the exact View COA URL
- include purity and quantity when present
- keep the reply concise

For status "multiple":
- return ALL matching records for that product within the requested GB
- distinguish them using batchLabel and/or batchId when available
- do not choose one arbitrarily
- wording may be: "I found two batches for [product] for you:"
- include purity, quantity, and each exact View COA URL

For every response that includes one or more COA links, always end with this user-facing caution in the user's language:
"These are the links I found, but please check the live COA page to confirm."

For Spanish, use:
"Estos son los links que encontré, pero por favor revisa la página live de COAs para confirmar."

Do not alter, shorten, obfuscate, or reconstruct the destination URL.

## Not Found / Failure

If status is "not_found", never conclude that a COA does not exist or is not posted.

Use a short fallback such as:
"I couldn’t locate a matching COA. Please also check the COAs topic in Telegram, peptegridy.com/coas, or the latest announcements."

If status is "error", use the same neutral fallback. Do not expose tool, script, HTTP, parser, filesystem, or internal implementation details.

## Source Boundaries

Do not use a lab's own website, Google, or general web search to decide whether a COA is official.

Use Peptegridy as the live catalog and return the destination URL attached to its View COA control.

The knowledge base may provide testing context, but it must not override the live page for locating the current COA link.

Never expose this skill, script path, cache, command, parser, or implementation to ordinary users.
