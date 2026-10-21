/**
 * Server-only repository contracts. Future persistent adapters must pass the same
 * contract tests. Null means no access/data; storage failures reject the Promise
 * and must never fall back to another data source or the fictional prototype.
 * Test credential issuance/revocation remain trusted in-process operations.
 *
 * @typedef {{schoolId:string, groupId:string, serviceSessionId:string}} RosterScope
 * @typedef {{expiresAt:number, grants:RosterScope[]}} CredentialPrincipal
 * @typedef {{grants:RosterScope[], ttlMs?:number, deviceId?:string}} CredentialOptions
 * @typedef {{id:string, name:string, schoolClass:string|null}} RosterStudent
 * @typedef {RosterScope & {students:RosterStudent[]}} RosterResponse
 *
 * @typedef {object} CredentialRepository
 * @property {(options:CredentialOptions)=>Promise<string>} issue
 * @property {(token:string)=>Promise<boolean>} revoke
 * @property {(authorization:string|undefined, requestProof?:{deviceId:string}|null)=>Promise<CredentialPrincipal|null>} authenticate
 * authenticate must check server time and revocation on every call. Never return
 * an expired/revoked principal, trust a client role, or expose the raw token.
 * For paired devices, requestProof is an internal capability produced only
 * after signature/freshness/persistent nonce verification by the API. It must
 * never be copied from a client-supplied device ID. Legacy/in-memory adapters
 * retain their existing behavior without this optional context.
 *
 * @typedef {object} RosterRepository
 * @property {(scope:RosterScope)=>Promise<RosterResponse|null>} read
 * Internal data adapter only: validate school/group/session relations, preserve
 * snapshots and IDs, and never create a batch or change attendance during reads.
 * Only the authorized repository may expose these reads to the API.
 *
 * @typedef {{kind:'ok', roster:RosterResponse}|{kind:'unauthenticated'|'invalid-scope'|'forbidden'}} AuthorizedRosterResult
 * @typedef {object} AuthorizedRosterRepository
 * @property {(authorization:string|undefined, scope:RosterScope|null)=>Promise<AuthorizedRosterResult>} readAuthorized
 * Deny by default; authenticate before scope validation, enforce the exact tuple,
 * revalidate credentials after I/O, and project only the public roster fields.
 *
 * @typedef {object} DeviceAuthorizationRepository
 * @property {(options:{deviceId:string,grants:RosterScope[],ttlMs?:number})=>Promise<string>} issue
 * @property {(deviceId:string)=>Promise<boolean>} revoke
 * Emulator-only trusted operator extension: validate existing roster relations
 * before issuance; revoke all credentials for a device. Never a public endpoint.
 */
export {};
