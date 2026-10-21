// Authoritative identities shared across schools; assignments remain separate.
export const MENTOR_CONFIG_REVISION=3;
const people={Hosea:'Lupi',Amos:'Chriz',Obaja:'Yulius',Zefanya:'Gabby',Zakharia:'Eva',Hagai:'Louis',Yunus:'Akris',Yoel:'Devid'};
import {GROUP_CONFIG} from './group-config.js';
export const INITIAL_DEFAULTS=GROUP_CONFIG.map(g=>({groupId:g.id,mentorId:'mentor-'+people[g.name].toLowerCase(),name:'Kak '+people[g.name]}));

export const APPROVED_MENTOR_IDS=new Set(INITIAL_DEFAULTS.map(m=>m.mentorId));
