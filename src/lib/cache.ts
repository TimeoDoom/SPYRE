import "server-only";

import { Redis } from "@upstash/redis";

// Initialiser Redis seulement si les variables d'environnement sont présentes
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    redis = new Redis({ url, token });
    return redis;
  }

  return null;
}

const CACHE_TTL = 60 * 60; // 1 heure

export async function getCachedMessage(id: string, mailbox: string) {
  try {
    const client = getRedis();
    if (!client) return null;

    const key = `mail:${mailbox}:${id}`;
    const cached = await client.get(key);
    return cached || null;
  } catch (error) {
    console.error("[cache] getCachedMessage error:", error);
    return null;
  }
}

export async function setCachedMessage(id: string, mailbox: string, data: any) {
  try {
    const client = getRedis();
    if (!client) return;

    const key = `mail:${mailbox}:${id}`;
    await client.set(key, data, { ex: CACHE_TTL });
  } catch (error) {
    console.error("[cache] setCachedMessage error:", error);
  }
}

export async function invalidateMessageCache(id: string, mailbox: string) {
  try {
    const client = getRedis();
    if (!client) return;

    const key = `mail:${mailbox}:${id}`;
    await client.del(key);
  } catch (error) {
    console.error("[cache] invalidateMessageCache error:", error);
  }
}
