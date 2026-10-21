import {createInMemoryCredentialRepository,createInMemoryRosterRepository} from '../backend/repositories.mjs';
import {registerRepositoryContracts} from './contracts/repositories.mjs';

registerRepositoryContracts({name:'in-memory',create:({now,source})=>({credentials:createInMemoryCredentialRepository({now}),repository:createInMemoryRosterRepository(source)})});
