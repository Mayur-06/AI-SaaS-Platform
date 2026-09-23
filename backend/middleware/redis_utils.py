import uuid
import logging
import time

import redis

from config.settings import REDIS_URL

logger = logging.getLogger(__name__)

_redis_client = None


def get_redis_client():
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1.0,
                socket_timeout=1.0,
            )
        except Exception as exc:
            logger.warning("Could not initialize Redis client: %s", exc)
            return None
    return _redis_client


RATE_LIMIT_LUA_SCRIPT = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)

local ttl = window + 1
if count == 0 then
    redis.call('EXPIRE', key, math.floor(ttl))
end

local reset_time = now + window
if count >= limit then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    if oldest and type(oldest) == 'table' and #oldest >= 2 then
        reset_time = tonumber(oldest[2]) + window
    end
    return {limit, count, math.floor(reset_time)}
end

redis.call('ZADD', key, now, now .. '-' .. math.random())
redis.call('EXPIRE', key, math.floor(ttl))
return {limit, count + 1, math.floor(reset_time)}
"""

_loaded_rate_limit_script = None


def get_rate_limit_script():
    global _loaded_rate_limit_script
    if _loaded_rate_limit_script is None:
        client = get_redis_client()
        _loaded_rate_limit_script = client.script_load(RATE_LIMIT_LUA_SCRIPT)
    return _loaded_rate_limit_script


def check_rate_limit(org_id, api_key_id, limit):
    client = get_redis_client()
    now = int(time.time())
    window = 60

    if api_key_id:
        key = f"ratelimit:{org_id}:{api_key_id}:{now // window}"
    else:
        key = f"ratelimit:{org_id}:{now // window}"

    script = get_rate_limit_script()
    result = client.evalsha(script, 1, key, now, window, limit)
    effective_limit, count, reset_time = result

    allowed = count <= effective_limit
    remaining = max(0, effective_limit - count)
    return allowed, remaining, reset_time


def check_token_rate_limit(org_id, api_key_id, limit, estimated_tokens=0):
    """
    Checks if token rate limit (TPM) is exceeded for the current 60s window.
    Returns (allowed, remaining, reset_time, current_tokens).
    """
    client = get_redis_client()
    now = int(time.time())
    window = 60
    current_bucket = now // window
    reset_time = (current_bucket + 1) * window
    if client is None:
        return True, limit, reset_time, 0

    key = f"ratelimit:tpm:{org_id}:{api_key_id or 'all'}:{current_bucket}"
    try:
        current_val = client.get(key)
        current_tokens = int(current_val) if current_val else 0
        if current_tokens + estimated_tokens > limit:
            return False, max(0, limit - current_tokens), reset_time, current_tokens
        return True, max(0, limit - current_tokens), reset_time, current_tokens
    except Exception as exc:
        logger.debug("Token rate limit Redis check error: %s", exc)
        return True, limit, reset_time, 0


def record_token_usage(org_id, api_key_id, tokens_consumed):
    """
    Increments token consumption in the current 60s sliding window.
    """
    if not tokens_consumed or tokens_consumed <= 0:
        return
    client = get_redis_client()
    if client is None:
        return
    now = int(time.time())
    window = 60
    current_bucket = now // window
    key = f"ratelimit:tpm:{org_id}:{api_key_id or 'all'}:{current_bucket}"
    try:
        pipe = client.pipeline()
        pipe.incrby(key, int(tokens_consumed))
        pipe.expire(key, window + 10)
        pipe.execute()
    except Exception as exc:
        logger.debug("Token rate limit Redis increment error: %s", exc)

