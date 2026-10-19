const E=require('./engine.js');const data=require('./data/transit.json');
const t0=Date.now();const e=new E(data);console.log('init ms',Date.now()-t0);
const P={HoGuom:[21.0285,105.8524],BXMyDinh:[21.0285,105.7787],BachMai:[21.0006,105.8410],BachKhoa:[21.0050,105.8433],TimesCity:[20.9951,105.8681],BXGiaLam:[21.0482,105.8785],HaDong:[20.9715,105.7788],CauGiay:[21.0362,105.7906],VanMieu:[21.0293,105.8355],NoiBai:[21.2187,105.8042],RoyalCity:[21.0029,105.8158],LotteLieuGiai:[21.0322,105.8126],LongBien:[21.0430,105.8500],GiapBat:[20.9805,105.8412]};
const pairs=[['HoGuom','BXMyDinh'],['BachMai','CauGiay'],['TimesCity','LotteLieuGiai'],['HaDong','BXGiaLam'],['VanMieu','NoiBai'],['RoyalCity','LongBien'],['GiapBat','BachKhoa'],['BachKhoa','BachMai']];
let ms=[];
for(const [a,b] of pairs){const s=Date.now();const r=e.plan(P[a],P[b]);ms.push(Date.now()-s);
 console.log(`\n${a} -> ${b}  chim bay ${Math.round(r.walkOnly)}m  (${ms.at(-1)}ms) nearA=${r.nearA} nearB=${r.nearB}`);
 r.options.forEach((o,i)=>console.log(` #${i+1} ${o.legs.map(l=>`[${l.codes.join(",")} ${E.cleanName(l.fromName)} → ${E.cleanName(l.toName)}, ${l.stops} trạm]`).join(' đổi ')} | đi bộ ${o.walkStart}+${o.walkXfer}+${o.walkEnd}m | score ${o.score}`));
 if(!r.options.length) console.log(' KHÔNG CÓ PHƯƠNG ÁN');}
console.log('\nmax ms',Math.max(...ms));
console.log(e.search('bach mai').map(x=>x.name));
console.log(e.search('cau giay').slice(0,4).map(x=>x.name));
