import {createPrototypeServer} from './server.mjs';
const port=Number(process.env.ABC_MENTOR_PORT||4176);
if(!Number.isSafeInteger(port)||port<1||port>65535||port===4173||port===Number(new URL(process.env.ABC_API_ORIGIN||'http://127.0.0.1:4175').port))throw Error('Port mentor lokal harus valid dan terpisah dari API/demo.');
createPrototypeServer({mentorMode:true,apiOrigin:process.env.ABC_API_ORIGIN||'http://127.0.0.1:4175'}).listen(port,'127.0.0.1',()=>console.log(`Mentor pairing lokal: http://127.0.0.1:${port}`));
