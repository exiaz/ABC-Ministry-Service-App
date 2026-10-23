import {createHash,randomBytes} from 'node:crypto';
import {isValidDate} from '../dates.js';

export const SCOPE_KEYS=['schoolId','groupId','serviceSessionId'];
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
export const validServiceSession=visit=>!!visit&&validId(visit.id)&&isValidDate(visit.date)&&visit.provisional!==true;
export function validRosterScope(scope){
  return !!scope&&SCOPE_KEYS.every(key=>validId(scope[key]));
}
const digest=token=>createHash('sha256').update(token).digest('hex');

// Test foundation only. Issuance/revocation are trusted in-process operations,
// never HTTP routes. Restart invalidates every credential; no production secrets.
export function createTestCredentialStore({now=Date.now}={}){
  const entries=new Map();
  return {
    issue({grants,ttlMs=300000}){
      if(!Number.isSafeInteger(ttlMs)||ttlMs<=0||ttlMs>3600000||!Array.isArray(grants)||!grants.length||!grants.every(validRosterScope)){
        throw Error('Cakupan atau masa berlaku kredensial uji tidak valid.');
      }
      const token=randomBytes(32).toString('base64url');
      const scopes=grants.map(scope=>Object.fromEntries(SCOPE_KEYS.map(key=>[key,scope[key]])));
      entries.set(digest(token),{expiresAt:now()+ttlMs,grants:scopes});
      return token;
    },
    revoke(token){
      if(typeof token!=='string')return false;
      return entries.delete(digest(token));
    },
    authenticate(header){
      const match=typeof header==='string'&&/^Bearer ([A-Za-z0-9_-]{43})$/.exec(header);
      if(!match)return null;
      const key=digest(match[1]),entry=entries.get(key);
      if(!entry)return null;
      if(entry.expiresAt<=now()){entries.delete(key);return null;}
      return structuredClone(entry);
    }
  };
}

export function canReadRoster(principal,scope){
  return validRosterScope(scope)&&Array.isArray(principal?.grants)&&principal.grants.some(grant=>SCOPE_KEYS.every(key=>grant[key]===scope[key]));
}
