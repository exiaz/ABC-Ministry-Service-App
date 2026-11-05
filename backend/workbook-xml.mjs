const entities={amp:'&',lt:'<',gt:'>',apos:"'",quot:'"'};
function decode(value){
  return value.replace(/&(?:(amp|lt|gt|apos|quot);|#(x[0-9a-fA-F]+|\d+);)?/g,(_,named,numeric)=>{
    if(named)return entities[named];
    if(!numeric)throw Error('Entitas XML tidak valid.');
    const code=numeric.startsWith('x')?parseInt(numeric.slice(1),16):Number(numeric);
    if(![9,10,13].includes(code)&&!(code>=32&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)&&code!==0xfffe&&code!==0xffff))throw Error('Karakter XML tidak valid.');
    return String.fromCodePoint(code);
  });
}

class Element{
  constructor(name,attributes=new Map()){
    this.name=name;
    this.attributes=attributes;
    this.children=[];
  }
  getAttribute(name){return this.attributes.get(name)??null;}
  getAttributeNS(namespace,name){
    for(const [key,value] of this.attributes){
      const [prefix,local]=key.split(':');
      if(local===name&&this.namespaces.get(prefix)===namespace)return value;
    }
    return null;
  }
  getElementsByTagNameNS(_,name){
    const result=[];
    function visit(element){
      for(const child of element.children){
        if(typeof child==='string')continue;
        if(child.name.split(':').at(-1)===name)result.push(child);
        visit(child);
      }
    }
    visit(this);
    return result;
  }
  get textContent(){return this.children.map(child=>typeof child==='string'?child:child.textContent).join('');}
}

// Strict OOXML subset. DTDs, general processing instructions and entity declarations are unsupported.
export function parseWorkbookXml(xml){
  const doc=new Element(''),stack=[doc];
  doc.namespaces=new Map([['xml','http://www.w3.org/XML/1998/namespace']]);
  const source=xml.replace(/^\s*<\?xml\s+[^?]*\?>/,'');
  const token=/<!--(?:[^-]|-(?!-))*-->|<\/[A-Za-z_][\w:.-]*\s*>|<[A-Za-z_][\w:.-]*(?:\s+[A-Za-z_][\w:.-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*\s*\/?>|[^<]+/gy;
  let count=0,position=0;
  while(position<source.length){
    const match=token.exec(source);
    if(!match||++count>750000)throw Error('Struktur XML tidak valid.');
    position=token.lastIndex;
    const part=match[0],parent=stack.at(-1);
    if(part.startsWith('<!--'))continue;
    if(part.startsWith('</')){
      if(stack.length===1||parent.name!==part.slice(2,-1).trim())throw Error('Penutup XML tidak sesuai.');
      stack.pop();
    }else if(part.startsWith('<')){
      const name=/^<([^\s/>]+)/.exec(part)[1],attributes=new Map();
      for(const attr of part.slice(name.length+1).matchAll(/([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)){
        if(attributes.has(attr[1]))throw Error('Atribut XML berulang.');
        attributes.set(attr[1],decode(attr[2]??attr[3]));
      }
      if(stack.length>32||parent===doc&&doc.children.length)throw Error('Struktur XML tidak valid.');
      const child=new Element(name,attributes);
      child.namespaces=parent.namespaces;
      const declarations=[...attributes].filter(([key])=>key.startsWith('xmlns:'));
      if(declarations.length)child.namespaces=new Map([...parent.namespaces,...declarations.map(([key,value])=>[key.slice(6),value])]);
      parent.children.push(child);
      if(!part.endsWith('/>'))stack.push(child);
    }else if(parent!==doc)parent.children.push(decode(part));
    else if(part.trim())throw Error('Teks di luar root XML.');
  }
  if(stack.length!==1||doc.children.length!==1)throw Error('Struktur XML tidak lengkap.');
  return doc;
}
