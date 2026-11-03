import {createConfiguredRepositories} from '../../backend/configured-repositories.mjs';
import {createRosterServer} from '../../backend/server.mjs';

// Isolated API process used to verify persistence across a real API restart.
const adapters=await createConfiguredRepositories();
const server=createRosterServer(adapters);
server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
process.on('message',message=>{
  if(message==='stop')server.close(async()=>{await adapters.close();process.exit(0);});
});
