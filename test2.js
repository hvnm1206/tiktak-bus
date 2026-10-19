const E=require('./engine.js');const e=new E(require('./data/transit.json'));
const A=[21.0006,105.8410],B=[21.0362,105.7906];
for(const mode of ['easy','lesswalk','lessxfer','lessstop']){
 const r=e.plan(A,B,{mode,now:new Date('2026-10-19T14:50:00Z')});
 console.log(mode, r.options.map(o=>o.legs.map(l=>(l.codes||[l.code]).join('/')+':'+l.stops+':'+(l.service&&l.service.state)).join('>')+' walk'+o.walkTotal).join(' | '));}
// late night 23:10 HN
const r=e.plan([21.0285,105.8524],[21.0285,105.7787],{now:new Date('2026-10-19T16:10:00Z')});
console.log('late', r.options.map(o=>o.legs.map(l=>l.code+':'+JSON.stringify(l.service)).join('>')));
console.log(E.parseTrip('từ Bạch Mai về Mỹ Đình'), E.parseTrip('đến Hồ Gươm'), E.parseTrip('Cầu Giấy'));
const s=e.search('benh vien bach mai')[0];console.log(s, e.routesAt(s.id).map(x=>x.code+'→'+x.toward).join(', '));
console.log(e.findRoute('32'), e.findRoute('tuyen e0'), e.routeStops('32').map(x=>x.dir+' '+x.stops.length));
