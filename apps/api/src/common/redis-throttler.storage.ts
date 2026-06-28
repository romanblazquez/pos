import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

const INCREMENT_SCRIPT = `
local block_ttl = redis.call('PTTL', KEYS[2])
if block_ttl > 0 then
  local blocked_hits = tonumber(redis.call('GET', KEYS[1]) or ARGV[2]) + 1
  return {blocked_hits, math.max(redis.call('PTTL', KEYS[1]), 0), 1, block_ttl}
end

local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  local duration = tonumber(ARGV[3])
  if duration <= 0 then duration = tonumber(ARGV[1]) end
  redis.call('PSETEX', KEYS[2], duration, '1')
  return {hits, ttl, 1, duration}
end
return {hits, ttl, 0, 0}
`;

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string) {
    if (this.redis.status === 'wait') await this.redis.connect();
    const prefix = `retail:throttle:${throttlerName}:${key}`;
    const result = await this.redis.eval(
      INCREMENT_SCRIPT, 2, `${prefix}:hits`, `${prefix}:block`, ttl, limit, blockDuration,
    ) as [number, number, number, number];
    return {
      totalHits: Number(result[0]),
      timeToExpire: Math.max(0, Math.ceil(Number(result[1]) / 1000)),
      isBlocked: Number(result[2]) === 1,
      timeToBlockExpire: Math.max(0, Math.ceil(Number(result[3]) / 1000)),
    };
  }
}
