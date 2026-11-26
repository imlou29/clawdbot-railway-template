import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

const ttl = 30 * 60_000;
const pendingTtl = 5 * 60_000;
const maxEntries = 256;
const freshRequest = /\b(?:update|latest|changed|new announcement|still|updates?|actualizaci[oó]n|novedades?|cambi(?:o|ó|os)|nuev[oa]s?|todav[ií]a|siguen?|[uú]ltim[oa])\b/iu;
const personalRequest = /\b(?:my|mine|i paid|i ordered|mi|mis|m[ií]o|pagu[eé]|compr[eé])\b/iu;
const uncertainReply = /(?:can['’]?t confirm|don['’]?t (?:know|have)|not (?:sure|documented|confirmed|available)|no (?:tengo|s[eé]|puedo confirm)|sin confirmar|escr[ií]bele|manda(?:le)? (?:un )?dm|(?:dm|message|contact|escribe|contacta) (?:to |a )?@?(?:imlou29|toffertimez|lou|toffer)\b)/iu;

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function questionKey(text) {
  if (typeof text !== "string" || text.length > 300 || /[\r\n]|https?:\/\/|[@#][^\s]+\s+[@#]/iu.test(text)) {
    return;
  }
  const trimmed = text.trim().replace(/^@tegridyai_bot\s+/iu, "").replace(/\s+@tegridyai_bot$/iu, "");
  if (
    !trimmed.endsWith("?") || trimmed.startsWith("/") || trimmed.includes("@") ||
    freshRequest.test(trimmed) || personalRequest.test(trimmed)
  ) {
    return;
  }
  const normalized = trimmed.normalize("NFKC").toLocaleLowerCase("und").replace(/\s+/gu, " ").replace(/^¿\s*|\s*\?$/gu, "");
  return normalized && !normalized.includes("?") ? digest(normalized) : undefined;
}

function replyText(text) {
  return typeof text === "string" ? text.trim().normalize("NFC") : "";
}

function boundedSet(map, key, value) {
  if (map.size >= maxEntries) map.delete(map.keys().next().value);
  map.set(key, value);
}

function readEntries(file, now) {
  try {
    const entries = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(entries) ? entries.filter(entry =>
      typeof entry?.key === "string" && typeof entry?.revision === "string" &&
      /^\d+$/u.test(entry?.messageId) && Number.isSafeInteger(entry?.sentAt) &&
      entry.sentAt <= now && now - entry.sentAt < ttl
    ).slice(-maxEntries) : [];
  } catch {
    return [];
  }
}

export default {
  id: "tegridy-reply-references",
  register(api) {
    const config = api.pluginConfig ?? {};
    const { sessionKey, directory, revisionFiles, accountId = "default" } = config;
    const topic = /^agent:[^:]+:telegram:group:-100(\d+):topic:(\d+)$/u.exec(sessionKey);
    if (!topic || typeof directory !== "string" || !isAbsolute(directory) ||
        !Array.isArray(revisionFiles) || !revisionFiles.length ||
        revisionFiles.some(path => typeof path !== "string" || !isAbsolute(path))) {
      api.logger.warn("Tegridy reply references are inactive until the topic and persistent paths are configured.");
      return;
    }

    const chat = "-100" + topic[1];
    const destinations = new Set([chat, "telegram:" + chat, chat + ":topic:" + topic[2], "telegram:" + chat + ":topic:" + topic[2]]);
    const prefix = "https://t.me/c/" + topic[1] + "/" + topic[2] + "/";
    const file = join(directory, "telegram-reply-references-" + digest(sessionKey + ":" + accountId).slice(0, 16) + ".json");
    const pending = new Map();
    const finals = new Map();
    const currentRevision = () => {
      try {
        return digest(JSON.stringify(revisionFiles.map(path => digest(readFileSync(path)))));
      } catch {
        return undefined;
      }
    };
    const inScope = (event, ctx) => {
      const channel = event.channel ?? ctx.channelId;
      const session = event.sessionKey ?? ctx.sessionKey;
      return channel === "telegram" && session === sessionKey &&
        (ctx.accountId ?? "default") === accountId;
    };

    api.on("before_dispatch", (event, ctx) => {
      const messageId = String(event.messageId ?? ctx.messageId ?? "");
      if (!inScope(event, ctx) || event.isGroup !== true || !/^\d+$/u.test(messageId)) return;

      pending.delete(messageId);
      const key = !event.replyToId && !ctx.replyToId && !event.replyToBody && questionKey(event.content);
      const revision = key && currentRevision();
      if (!revision) return;

      const now = Date.now();
      const entry = readEntries(file, now).find(item =>
        item.key === key && item.revision === revision && item.messageId !== messageId
      );
      if (entry) {
        const spanish = /[¿áéíóúñ]|\b(?:qu[eé]|d[oó]nde|cu[aá]ndo|c[oó]mo|est[aá]n?|cu[aá]nto)\b/iu.test(event.content);
        const url = prefix + entry.messageId;
        const text = spanish
          ? "Ya respondí esa pregunta aquí → [Ver respuesta anterior](" + url + ") 👆"
          : "I answered that here → [See my earlier reply](" + url + ") 👆";
        boundedSet(pending, messageId, { redirect: text, startedAt: now });
        return { handled: true, text };
      }
      boundedSet(pending, messageId, { key, revision, startedAt: now });
    });

    api.on("reply_payload_sending", (event, ctx) => {
      const inboundId = String(ctx.messageId ?? "");
      if (event.kind !== "final" || !inScope(event, ctx) || !/^\d+$/u.test(inboundId)) return;
      const request = pending.get(inboundId);
      if (!request || Date.now() - request.startedAt >= pendingTtl) return;

      const body = replyText(event.payload?.text);
      if (request.redirect) {
        if (body === request.redirect) {
          return { payload: { ...event.payload, replyToId: inboundId } };
        }
        return;
      }
      const runId = event.runId ?? ctx.runId;
      if (!runId || !body || body.length > 900 || uncertainReply.test(body) ||
          event.payload.isError || event.payload.isReasoning || event.payload.mediaUrl ||
          event.payload.mediaUrls?.length || event.payload.audioAsVoice) {
        if (runId) finals.delete(runId);
        return;
      }

      boundedSet(finals, runId, { inboundId, textHash: digest(body) });
    });

    api.on("message_sent", (event, ctx) => {
      const runId = event.runId ?? ctx.runId;
      if (!runId || !inScope(event, ctx) || !destinations.has(ctx.conversationId ?? event.to)) return;
      const final = finals.get(runId);
      if (!final || digest(replyText(event.content)) !== final.textHash) return;
      finals.delete(runId);

      const request = pending.get(final.inboundId);
      pending.delete(final.inboundId);
      const messageId = String(event.messageId ?? "");
      const now = Date.now();
      if (!event.success || !/^\d+$/u.test(messageId) || !request ||
          now - request.startedAt >= pendingTtl || request.revision !== currentRevision()) return;

      try {
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        const entries = readEntries(file, now).filter(entry => entry.key !== request.key);
        entries.push({ key: request.key, revision: request.revision, messageId, sentAt: now });
        const temporary = file + ".pending";
        writeFileSync(temporary, JSON.stringify(entries.slice(-maxEntries)), { mode: 0o600 });
        renameSync(temporary, file);
      } catch {
        api.logger.warn("Tegridy reply references could not save a delivery receipt.");
      }
    });
  },
};
