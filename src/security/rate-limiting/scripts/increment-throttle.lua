local blockedTtl = redis.call('PTTL', KEYS[2])
if blockedTtl > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
  local hitsTtl = math.max(redis.call('PTTL', KEYS[1]), 0)
  return { hits, hitsTtl, 1, blockedTtl }
end

local hits = redis.call('INCR', KEYS[1])
local hitsTtl = redis.call('PTTL', KEYS[1])
if hits == 1 or hitsTtl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  hitsTtl = tonumber(ARGV[1])
end

local isBlocked = 0
local timeToBlockExpire = 0
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  isBlocked = 1
  timeToBlockExpire = tonumber(ARGV[3])
end

return { hits, hitsTtl, isBlocked, timeToBlockExpire }
