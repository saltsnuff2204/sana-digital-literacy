const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const root = path.resolve(__dirname, '..');
const cache = {};
function load(name) {
 if(cache[name])return cache[name].exports;
 const filename=path.join(root,'src',name+'.ts');
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod=new Module(filename,module);cache[name]=mod;mod.filename=filename;mod.paths=module.paths;
 mod.require=(id)=>id.startsWith('./')?load(id.slice(2)):require(id);
 mod._compile(code,filename);return mod.exports;
}
const content=load('content');
if(require.main===module){fs.mkdirSync(path.join(root,'generated'),{recursive:true});fs.writeFileSync(path.join(root,'generated','lessons.json'),JSON.stringify(content.lessons,null,2));console.log(`${content.lessons.length} lessons exported`);}
module.exports={...content,...load('model')};
