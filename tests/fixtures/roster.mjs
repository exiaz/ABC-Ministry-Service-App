// Fictional server-only fixture. Never imported by the frontend or HTTP startup.
export const scope={schoolId:'s1',groupId:'g1',serviceSessionId:'demo-pakel-2026-10-09'};
export function fictionalRosterData(){
  return {
    schools:[{id:'s1',name:'Sekolah Fiktif Satu'},{id:'s2',name:'Sekolah Fiktif Dua'}],
    groups:[{id:'g1',schoolId:'s1',name:'Hosea Fiktif'},{id:'g2',schoolId:'s1',name:'Amos Fiktif'},{id:'g4',schoolId:'s2',name:'Kelompok Sekolah Lain'}],
    serviceSessions:[
      {id:scope.serviceSessionId,schoolId:'s1',date:'2026-10-09',groupIds:['g1','g2']},
      {id:'demo-pakel-2026-10-23',schoolId:'s1',date:'2026-10-23',groupIds:['g1','g2']},
      {id:'demo-airlangga-2026-10-16',schoolId:'s2',date:'2026-10-16',groupIds:['g4']}
    ],
    mentors:[{id:'fictional-mentor',name:'Kak Mentor Fiktif'},{id:'fictional-substitute',name:'Kak Pengganti Fiktif'}],
    defaultMentorAssignments:[{id:'fictional-default',groupId:'g1',mentorId:'fictional-mentor',effectiveFrom:'2026-01-01'}],
    sessionMentorOverrides:[{id:'fictional-override',groupId:'g1',mentorId:'fictional-substitute',serviceSessionId:'demo-pakel-2026-10-23'}],
    mentorAssignmentSnapshots:[{id:'fictional-mentor-snapshot',groupId:'g1',serviceSessionId:scope.serviceSessionId,serviceDate:'2026-10-09',mentorId:'fictional-mentor',mentorName:'Kak Riwayat Fiktif',capturedAt:'2026-10-09T03:00:00Z'}],
    students:[
      {id:'fictional-1',name:'Siswa Fiktif Terkini',schoolClass:'5A',schoolId:'s1',groupId:'g1',active:true},
      {id:'fictional-2',name:'Siswa Fiktif Baru',schoolClass:null,schoolId:'s1',groupId:'g1',active:true},
      {id:'fictional-inactive',name:'Siswa Fiktif Nonaktif',schoolClass:'4A',schoolId:'s1',groupId:'g1',active:false},
      {id:'fictional-other',name:'Siswa Fiktif Sekolah Lain',schoolClass:'3A',schoolId:'s2',groupId:'g4',active:true}
    ],
    sessions:[{
      id:'fictional-batch',...scope,state:'completed',updatedAt:'2026-10-09T03:30:00Z',
      records:[{studentId:'fictional-1',name:'Siswa Fiktif Snapshot',schoolClass:'4A',status:'present',gender:'male',dateOfBirth:'2015-01-01',guardianName:'WALI_FIKTIF_PRIVAT',address:'ALAMAT_FIKTIF_PRIVAT',studentPrivateProfiles:{secret:'PROFIL_FIKTIF_PRIVAT'}}]
    }],
    studentPrivateProfiles:{'fictional-1':{dateOfBirth:'2015-01-01',guardianName:'WALI_FIKTIF_PRIVAT',address:'ALAMAT_FIKTIF_PRIVAT'}}
  };
}
