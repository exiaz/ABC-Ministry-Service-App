import {createTestCredentialStore,canReadRoster,validRosterScope,SCOPE_KEYS} from './access-control.mjs';
import {createRosterRepository,toRosterResponse} from './roster.mjs';

// Default development adapters retain Milestone 1 semantics and in-memory data.
// The synchronous factories remain available to existing trusted callers/tests.
/** @returns {import('./repository-contracts.mjs').CredentialRepository} */
export function createInMemoryCredentialRepository(options){
  const store=createTestCredentialStore(options);
  return {
    async issue(values){return store.issue(values);},
    async revoke(token){return store.revoke(token);},
    async authenticate(authorization){return store.authenticate(authorization);}
  };
}

/** @returns {import('./repository-contracts.mjs').RosterRepository} */
export function createInMemoryRosterRepository(source){
  const repository=createRosterRepository(source);
  return {async read(scope){return repository.read(scope);}};
}

/**
 * @param {{credentials:import('./repository-contracts.mjs').CredentialRepository, repository:import('./repository-contracts.mjs').RosterRepository}} adapters
 * @returns {import('./repository-contracts.mjs').AuthorizedRosterRepository}
 */
export function createAuthorizedRosterRepository({credentials,repository}){
  return {
    async readAuthorized(authorization,requestedScope){
      // Capture the request before any asynchronous adapter call.
      const scope=validRosterScope(requestedScope)?Object.fromEntries(SCOPE_KEYS.map(key=>[key,requestedScope[key]])):null;
      const principal=await credentials.authenticate(authorization);
      if(!principal)return {kind:'unauthenticated'};
      if(!scope)return {kind:'invalid-scope'};
      if(!canReadRoster(principal,scope))return {kind:'forbidden'};
      const roster=await repository.read({...scope});
      // Revocation, expiration, or grant changes while awaiting storage must deny.
      const current=await credentials.authenticate(authorization);
      if(!current)return {kind:'unauthenticated'};
      if(!canReadRoster(current,scope))return {kind:'forbidden'};
      if(!roster||!SCOPE_KEYS.every(key=>roster[key]===scope[key]))return {kind:'forbidden'};
      return {kind:'ok',roster:toRosterResponse(scope,roster.students)};
    }
  };
}
