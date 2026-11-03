// Pure scheduling rules for the persistent Mentor session. The server's
// sessionExpiresAt is the final limit: once the access token is bounded by it,
// another renewal cannot extend anything, so none is scheduled.
export const RENEW_BEFORE=60000,MIN_RENEW_DELAY=1000,RATE_LIMIT_RETRY=30000;

export function renewalPlan({now,accessExpiresAt,sessionExpiresAt}){
  const final=accessExpiresAt>=sessionExpiresAt;
  return {final,expireIn:Math.max(0,accessExpiresAt-now),renewIn:final?null:Math.max(MIN_RENEW_DELAY,accessExpiresAt-now-RENEW_BEFORE),onExpire:final?'signed-out':'unavailable'};
}

// A rate limit (429) does not invalidate the bearer already held, so it stays
// usable until its own expiry; every other failure hides private data.
export function renewalFailure({status,now,accessExpiresAt}){
  if(status===401||status===403)return {action:'signed-out'};
  if(status===429&&now<accessExpiresAt)return {action:'keep',retryIn:Math.min(RATE_LIMIT_RETRY,Math.max(MIN_RENEW_DELAY,accessExpiresAt-now))};
  return {action:'unavailable'};
}
