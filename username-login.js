export function usernameFields({nameId='admin-username',passwordId='admin-password',disabled=false}={}){
  if(![nameId,passwordId].every(id=>/^[a-z][a-z0-9-]*$/.test(id)))throw Error('ID isian login tidak valid.');
  return `<div class="form-row"><label for="${nameId}">Username</label><input id="${nameId}" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="32" ${disabled?'disabled':''}></div><div class="form-row"><label for="${passwordId}">Kata sandi Anda</label><input id="${passwordId}" name="password" type="password" autocomplete="current-password" required maxlength="128" ${disabled?'disabled':''}></div>`;
}
