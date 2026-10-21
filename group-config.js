// Authoritative predefined school/group configuration, in the supplied order.
// Existing roster IDs remain stable even when the supplied display order changes.
export const GROUP_CONFIG_REVISION = 2;
export const SCHOOL_CONFIG = [
  {id:'s1',name:'SDN Pacarkeling V',area:'Pacarkeling, Surabaya',color:'blue',monthlyVisits:2},
  {id:'s2',name:'SDN Airlangga III',area:'Airlangga, Surabaya',color:'red',monthlyVisits:1},
  {id:'s3',name:'SDN Kertajaya IV',area:'Kertajaya, Surabaya',color:'yellow',monthlyVisits:1}
];
export const GROUP_CONFIG = [
  {id:'g1',schoolId:'s1',name:'Hosea',demoRosterIndex:0},
  {id:'g11',schoolId:'s1',name:'Amos'},
  {id:'g2',schoolId:'s1',name:'Obaja',demoRosterIndex:1},
  {id:'g12',schoolId:'s1',name:'Zefanya'},
  {id:'g3',schoolId:'s1',name:'Zakharia',demoRosterIndex:2},
  {id:'g13',schoolId:'s1',name:'Hagai'},
  {id:'g10',schoolId:'s1',name:'Yunus'},
  {id:'g14',schoolId:'s1',name:'Yoel'},
  {id:'g4',schoolId:'s2',name:'Amos',demoRosterIndex:3},
  {id:'g5',schoolId:'s2',name:'Zakharia',demoRosterIndex:4},
  {id:'g6',schoolId:'s2',name:'Obaja',demoRosterIndex:5},
  {id:'g15',schoolId:'s2',name:'Zefanya'},
  {id:'g7',schoolId:'s3',name:'Zakharia',demoRosterIndex:6},
  {id:'g8',schoolId:'s3',name:'Zefanya',demoRosterIndex:7},
  {id:'g9',schoolId:'s3',name:'Obaja',demoRosterIndex:8},
  {id:'g18',schoolId:'s3',name:'Amos'}
];
// Obsolete predefined groups remain accessible to history; no roster is moved.
export const RETIRED_GROUP_IDS=['g16','g17'];
export const activeGroups=db=>db.groups.filter(g=>!g.retired);
