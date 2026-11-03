import {registerRepositoryContracts} from '../contracts/repositories.mjs';
import {emulatorFixture} from './fixture.mjs';

registerRepositoryContracts({name:'firestore-emulator',create:emulatorFixture});
