import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.md':'text/plain; charset=utf-8'};
const allowed=new Set(['index.html','app.js','data.js','student-data.js','birthdays.js','birthday-ui.js','xlsx-reader.js','student-import.js','dates.js','group-config.js','service-config.js','scheduling.js','service-ui.js','reports.js','mentor-config.js','assignments.js','assignment-ui.js','xlsx.js','styles.css','sw.js','icon.svg','manifest.webmanifest','assets/abc-movement-logo.png']);
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const name=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';if(!allowed.has(name)){res.writeHead(404);res.end('Tidak ditemukan');return;}const body=await readFile(path.join(root,name));res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(body);}catch{res.writeHead(500);res.end('Halaman tidak dapat dibuka');}}).listen(port,'127.0.0.1',()=>console.log(`ABC Goes to School: http://127.0.0.1:${port}`));
