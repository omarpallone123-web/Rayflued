/* AzBrain: modello linguistico creato da zero (n-grammi 4 con backoff + vettori semantici appresi). Browser e Node. */
(function(g){
const TK=t=>t.toLowerCase().match(/[\p{L}\p{N}']+|[.,;:!?]/gu)||[],END=/^[.!?]$/,WD=/^[\p{L}\p{N}']+$/u,D=32;
const LS=typeof localStorage!=='undefined'?localStorage:null,ixc=new Map();
function ix(w){let v=ixc.get(w);if(!v){let h=2166136261;for(let i=0;i<w.length;i++){h^=w.charCodeAt(i);h=Math.imul(h,16777619)}v=[];
  for(let k=0;k<4;k++){h=Math.imul(h^(h>>>15),2246822519)>>>0;v.push([h%D,(h>>>8)&1?1:-1])}ixc.set(w,v)}return v}
const cos=(a,b)=>{let d=0,x=0,y=0;for(let i=0;i<D;i++){d+=a[i]*b[i];x+=a[i]*a[i];y+=b[i]*b[i]}return x&&y?d/Math.sqrt(x*y):0};
const SEED=`Il mare è un grande specchio che custodisce la memoria del cielo. Di notte le stelle brillano come piccole idee che aspettano di essere raccolte. Il tempo scorre piano e porta con sé storie, ricordi e nuove scoperte. Imparare significa trasformare la curiosità in conoscenza. Un robot sogna di capire il mare e le stelle. Ogni viaggio comincia con una domanda e finisce con un'altra domanda. La musica è un ponte tra le persone, anche quando le parole non bastano. Il vento racconta storie antiche alle montagne silenziose. Una buona idea nasce quando due mondi lontani si incontrano. La luce della luna illumina il cammino di chi cerca la verità. The sea is a great mirror that keeps the memory of the sky. At night the stars shine like small ideas waiting to be gathered. Time flows slowly and carries stories, memories and new discoveries. Learning means turning curiosity into knowledge. Every journey begins with a question and ends with another question. A good idea is born when two distant worlds meet.`;
class AzBrain{
  constructor(key){this.key=key||'azbrain';this.m={};this.vec={};this.df={};this.nd=0;this.n=0;this.ec=0;this.nv=0;if(!this.load())this.train(SEED)}
  /* Impara da un testo: aggiorna il modello di parole e i significati (vettori di contesto) */
  train(text){
    const seen=new Set();
    for(const s of text.replace(/\s+/g,' ').match(/[^.!?]+[.!?]*/g)||[]){
      const w=TK(s);if(w.length<3)continue;const t=['^','^','^',...w];if(!END.test(t[t.length-1]))t.push('.');
      for(let i=3;i<t.length;i++)for(let k=0;k<4;k++){const key=k+'|'+t.slice(i-k,i).join(' ');let r=this.m[key];if(!r){r=this.m[key]={};this.ec++}r[t[i]]=(r[t[i]]||0)+1}
      w.forEach((x,i)=>{if(!WD.test(x))return;seen.add(x);let v=this.vec[x];if(!v){if(this.nv>6000)return;v=this.vec[x]=new Array(D).fill(0);this.nv++}
        for(let j=Math.max(0,i-3);j<=Math.min(w.length-1,i+3);j++)if(j!==i&&WD.test(w[j]))for(const[p,sg]of ix(w[j]))v[p]+=sg});
      this.n+=w.length}
    seen.forEach(x=>this.df[x]=(this.df[x]||0)+1);this.nd++;
    if(this.ec>45000){const ks=Object.keys(this.m);ks.slice(0,ks.length>>2).forEach(k=>{if(k!=='0|'){delete this.m[k];this.ec--}})}}
  /* Distribuzione della parola successiva: interpolazione 4-gram, 3-gram, 2-gram, 1-gram */
  next(h,o,rec){
    const P={},lam=[.04,.12,.3,.54];
    for(let k=3;k>=0;k--){const r=this.m[k+'|'+h.slice(h.length-k).join(' ')];if(!r)continue;let tot=0;for(const w in r)tot+=r[w];for(const w in r)if(w!=='^')P[w]=(P[w]||0)+lam[k]*r[w]/tot}
    const e=Object.entries(P);if(!e.length)return null;
    for(const x of e){let p=x[1];const w=x[0];if(WD.test(w)&&rec.includes(w))p*=.35;if(o.tv&&this.vec[w])p*=1+o.bias*Math.max(0,cos(this.vec[w],o.tv));x[1]=Math.pow(p,1/o.temp)}
    e.sort((a,b)=>b[1]-a[1]);const c=e.slice(0,o.topk);let r=Math.random()*c.reduce((a,x)=>a+x[1],0);
    for(const x of c){r-=x[1];if(r<=0)return x[0]}return c[0][0]}
  /* Genera testo: guidato dall'argomento (bias semantico), con temperatura, top-k e penalità di ripetizione */
  gen(topic,o){
    o=Object.assign({len:40,temp:.85,topk:30,bias:3,prefix:''},typeof o==='number'?{len:o}:o);
    o.tv=this.sv(topic||'');if(!o.tv.some(x=>x))o.tv=null;
    const pre=o.prefix?TK(o.prefix):[],h=['^','^','^',...pre],out=[];
    for(let i=0;i<o.len*2;i++){const w=this.next(h,o,out.slice(-12));if(!w)break;h.push(w);out.push(w);if(END.test(w))h.push('^','^','^');if(out.length>=o.len&&END.test(w))break;if(out.length>=o.len*1.5)break}
    if(out.length&&!END.test(out[out.length-1]))out.push('.');
    return this.fmt(pre.concat(out))}
  fmt(t){let s='',cap=true;for(const w of t){if(/^[.,;:!?]$/.test(w)){s+=w;if(END.test(w))cap=true;continue}s+=(s?' ':'')+(cap?w.charAt(0).toUpperCase()+w.slice(1):w);cap=false}return s}
  sv(text){const v=new Array(D).fill(0);TK(text).forEach(w=>{const x=this.vec[w];if(x)for(let i=0;i<D;i++)v[i]+=x[i]});return v}
  /* Parole più vicine per significato (usa i vettori imparati) */
  near(w,n){const v=this.vec[w.toLowerCase()];if(!v)return[];return Object.keys(this.vec).filter(x=>x!==w).map(x=>[x,cos(v,this.vec[x])]).sort((a,b)=>b[1]-a[1]).slice(0,n||5).map(x=>x[0])}
  /* Comprensione: sceglie le n frasi migliori per una domanda (TF-IDF + somiglianza semantica) o riassume se q è vuota */
  best(q,text,n){
    const ss=(text.replace(/\s+/g,' ').match(/[^.!?]{25,}[.!?]/g)||[]).map(x=>x.trim());if(!ss.length)return text.slice(0,400);
    const qs=new Set(TK(q).filter(w=>WD.test(w))),qv=this.sv(q),f={},idf=w=>Math.log((this.nd+2)/((this.df[w]||0)+1))+1;
    TK(text).forEach(w=>f[w]=(f[w]||0)+1);
    return ss.map((s,i)=>{const t=TK(s).filter(w=>w.length>2&&WD.test(w));let v=0;t.forEach(w=>v+=Math.log(1+f[w])*idf(w)*(qs.has(w)?4:1));
      return{s,i,v:v/Math.sqrt(t.length+5)+(qs.size?3*cos(this.sv(s),qv):0)+(i?0:1)}}).sort((a,b)=>b.v-a.v).slice(0,n).sort((a,b)=>a.i-b.i).map(x=>x.s).join(' ')}
  /* Perplessità: più è bassa, meglio il modello conosce il testo */
  ppl(text){const t=['^','^','^',...TK(text)];let l=0,c=0;for(let i=3;i<t.length;i++){let p=1e-6;for(const[k,lm]of[[3,.54],[2,.3],[1,.12],[0,.04]]){const r=this.m[k+'|'+t.slice(i-k,i).join(' ')];if(r&&r[t[i]]){let tot=0;for(const w in r)tot+=r[w];p+=lm*r[t[i]]/tot}}l-=Math.log(p);c++}return Math.exp(l/Math.max(c,1))}
  size(){return this.ec}
  dump(){return JSON.stringify({m:this.m,vec:this.vec,df:this.df,nd:this.nd,n:this.n})}
  restore(s){const d=JSON.parse(s);if(!d||!d.m)return 0;Object.assign(this,d);this.ec=Object.keys(this.m).length;this.nv=Object.keys(this.vec).length;return 1}
  save(){try{LS&&LS.setItem(this.key,this.dump())}catch(e){}}
  load(){try{return LS&&LS.getItem(this.key)?this.restore(LS.getItem(this.key)):0}catch(e){return 0}}
  reset(){this.m={};this.vec={};this.df={};this.nd=this.n=this.ec=this.nv=0;this.train(SEED);this.save()}
}
if(typeof module!=='undefined')module.exports=AzBrain;else g.AzBrain=AzBrain;
})(typeof window!=='undefined'?window:globalThis);
