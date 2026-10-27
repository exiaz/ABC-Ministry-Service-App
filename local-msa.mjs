import {runPilot,stopPilot} from './local-auth-pilot.mjs';
const command=process.argv[2];
const work=process.platform!=='win32'||process.argv.length!==3?Promise.reject(Error('Gunakan Start MSA.cmd atau Stop MSA.cmd.')):command==='start'?runPilot({unified:true}):command==='stop'?stopPilot():Promise.reject(Error('Perintah MSA tidak valid.'));
work.catch(error=>{console.error(error.pilotSafe||error.demoSafe?error.message:'Peluncur MSA gagal. Periksa Node.js, Java, dependensi dan port lokal.');process.exitCode=1;});
