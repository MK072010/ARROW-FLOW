/* Independent level check: its own decoder and solver, importing none of the project's rules/codec code.
     node tools/verify-levels-independent.js     -> prints a summary and writes tools/out/independent-verification.json */
const fs=require('fs'),crypto=require('crypto'),vm=require('vm');
const path=require('path');const root=path.resolve(__dirname,'..');
const J=JSON.parse(fs.readFileSync(root+'/data/levels.v1.json','utf8'));
const sb={window:{}};vm.createContext(sb);
vm.runInContext(fs.readFileSync(root+'/data/levels.v1.js','utf8'),sb);
const JS=sb.window.AF.LEVEL_DATA;
const sameData=JSON.stringify(J)===JSON.stringify(JS);
console.log('json==js data:',sameData,'count',J.levels.length,J.count);
const S={u:[0,-1],d:[0,1],l:[-1,0],r:[1,0]};
let bad=[],under6=[],few15=[],sizes={},arrowsMin=1e9,arrowsMax=0,sig=new Map(),dupes=[],ids=new Set();
const maxB=Math.max(...J.levels.map(l=>Math.max(l.c,l.r)));
J.levels.forEach((L,idx)=>{
  const errs=[];
  if(L.id!==idx+1)errs.push('id seq');
  if(ids.has(L.id))errs.push('dup id');ids.add(L.id);
  const occ=new Map();const arrows=[];
  L.a.forEach((s,i)=>{
    let x=parseInt(s[0],36),y=parseInt(s[1],36);const cells=[[x,y]];
    for(let k=2;k<s.length;k++){const d=S[s[k]];if(!d){errs.push('bad letter');return;}x+=d[0];y+=d[1];cells.push([x,y]);}
    if(cells.length<2)errs.push('short arrow');
    cells.forEach(([cx,cy])=>{if(cx<0||cy<0||cx>=L.c||cy>=L.r)errs.push('oob a'+i);const k=cx+','+cy;if(occ.has(k))errs.push('overlap '+k);occ.set(k,i);});
    arrows.push({cells,dir:S[s[s.length-1]]});
  });
  // solver: repeatedly remove free arrows
  let active=new Set(arrows.map((_,i)=>i));let prog=true;
  while(active.size&&prog){prog=false;
    for(const i of [...active]){const a=arrows[i];const h=a.cells[a.cells.length-1];let x=h[0]+a.dir[0],y=h[1]+a.dir[1],blocked=false;
      while(x>=0&&y>=0&&x<L.c&&y<L.r){const o=occ.get(x+','+y);if(o!==undefined&&o!==i&&active.has(o)){blocked=true;break;}x+=a.dir[0];y+=a.dir[1];}
      if(!blocked){active.delete(i);prog=true;}}}
  if(active.size)errs.push('UNSOLVABLE stuck '+active.size);
  const n=L.a.length;arrowsMin=Math.min(arrowsMin,n);arrowsMax=Math.max(arrowsMax,n);
  const sz=L.c+'x'+L.r;sizes[sz]=(sizes[sz]||0)+1;
  if(L.c<6||L.r<6)under6.push(L.id+':'+sz);
  if(L.c>25||L.r>25)errs.push('>25');
  if(n<15)few15.push(L.id+':'+n);
  const k=L.c+'x'+L.r+'|'+[...L.a].sort().join(',');
  if(sig.has(k))dupes.push([sig.get(k),L.id]);else sig.set(k,L.id);
  const bent=arrows.filter(a=>{for(let i=2;i<a.cells.length;i++){const p=a.cells[i-2],q=a.cells[i-1],r=a.cells[i];if((q[0]-p[0])!==(r[0]-q[0])||(q[1]-p[1])!==(r[1]-q[1]))return true;}return false;}).length;
  L._bent=bent;
  if(errs.length)bad.push([L.id,errs.slice(0,3)]);
});
console.log('levels with errors:',bad.length,JSON.stringify(bad.slice(0,10)));
console.log('max board',maxB,'min arrows',arrowsMin,'max arrows',arrowsMax);
console.log('levels with a side <6:',under6.join(' '));
console.log('levels with <15 arrows (count',few15.length+'): first 1-5 =',few15.filter(s=>+s.split(':')[0]<=5).join(' '),'| 6+ count',few15.filter(s=>+s.split(':')[0]>5).length);
console.log('exact duplicates:',dupes.length,JSON.stringify(dupes.slice(0,5)));
console.log('levels with >=1 bent arrow:',J.levels.filter(l=>l._bent>0).length,'| levels 1-5 bent:',J.levels.slice(0,5).map(l=>l._bent).join(','));
console.log('sha256 file:',crypto.createHash('sha256').update(JSON.stringify(J.levels.map(l=>{const c={...l};delete c._bent;return c;}))).digest('hex'),'declared:',J.sha256);
console.log('size distribution (top):',JSON.stringify(Object.entries(sizes).sort((a,b)=>b[1]-a[1]).slice(0,8)));

const summary={checkedAt:new Date().toISOString(),levels:J.levels.length,declaredCount:J.count,jsonEqualsJsWrapper:sameData,
 levelsWithErrors:bad.length,errors:bad.slice(0,20),maxBoardSide:maxB,minArrows:arrowsMin,maxArrows:arrowsMax,
 levelsWithSideBelow6:under6,levelsBelow15Arrows:{total:few15.length,legacy1to5:few15.filter(s=>+s.split(':')[0]<=5),from6:few15.filter(s=>+s.split(':')[0]>5).length},
 exactDuplicates:dupes.length,levelsWithBentArrow:J.levels.filter(l=>l._bent>0).length,
 shaMatches:crypto.createHash('sha256').update(JSON.stringify(J.levels.map(l=>{const c={...l};delete c._bent;return c;}))).digest('hex')===J.sha256};
require('fs').mkdirSync(path.join(__dirname,'out'),{recursive:true});
require('fs').writeFileSync(path.join(__dirname,'out/independent-verification.json'),JSON.stringify(summary,null,1));
process.exit(summary.levelsWithErrors||!summary.jsonEqualsJsWrapper||!summary.shaMatches||summary.exactDuplicates?1:0);
