import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
const files=[...readdirSync('.').filter(f=>/\.m?js$/.test(f)),...['tests','backend'].flatMap(dir=>readdirSync(dir,{recursive:true}).filter(f=>/\.m?js$/.test(f)).map(f=>dir+'/'+f))];
for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8',windowsHide:true});
  if(result.status!==0)throw Error(result.stderr);
  for(const [,path] of readFileSync(file,'utf8').matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g)){
    if(!existsSync(resolve(dirname(file),path)))throw Error(`Missing import ${path} in ${file}`);
  }
}
console.log(`${files.length} JS/MJS files: syntax and local imports passed. Buildless JavaScript; no TypeScript compiler configured.`);
