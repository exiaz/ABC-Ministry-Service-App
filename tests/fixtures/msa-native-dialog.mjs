import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';

// Component test of our own WPF form: fill its controls from fictional stdin
// data and invoke its real Save handler. No runtime bypass or HTTP bootstrap.
export async function fixtureNativeDialog({username,established,signal,password,currentPassword=''}){
  const source=await readFile(new URL('../../local-msa-password.ps1',import.meta.url),'utf8');
  const script=source.replace('  if ($window.ShowDialog()) {',`  $window.Add_ContentRendered({
    $window.FindName('Password').Password = $request.fixturePassword
    $window.FindName('Confirm').Password = $request.fixturePassword
    $window.FindName('Current').Password = $request.fixtureCurrent
    $window.FindName('Save').RaiseEvent((New-Object Windows.RoutedEventArgs ([Windows.Controls.Button]::ClickEvent)))
  })
  if ($window.ShowDialog()) {`);
  return new Promise((resolve,reject)=>{
    const child=spawn(path.join(process.env.SystemRoot??'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-STA','-Command',script],{windowsHide:true,stdio:['pipe','pipe','ignore']});
    let output='';const stop=()=>child.kill(),timer=setTimeout(stop,15000);
    signal?.addEventListener('abort',stop,{once:true});child.stdin.on('error',()=>{});
    child.stdout.on('data',chunk=>{output+=chunk;if(output.length>4096)stop();});
    child.once('error',()=>{clearTimeout(timer);reject(Error('Native test dialog failed to start'));});
    child.once('exit',code=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);try{if(code!==0)throw Error();const value=JSON.parse(output);output='';resolve(value);}catch{reject(Error('Native test dialog did not complete'));}});
    child.stdin.end(JSON.stringify({username,established,fixturePassword:password,fixtureCurrent:currentPassword}));if(signal?.aborted)stop();
  });
}
