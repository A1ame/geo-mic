import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, MicOff, MapPin, Clock, LogOut, ShieldCheck, Users, RefreshCw } from 'lucide-react';

const ParticipantView = ({ socket, peer, userName, onExit }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>('idle');
  const [availableAdmins, setAvailableAdmins] = useState<any[]>([]);
  const [allParticipants, setAllParticipants] = useState<any[]>([]);
  const [isApproved, setIsApproved] = useState(() => localStorage.getItem('isApproved') === 'true');
  const [activeAdminData, setActiveAdminData] = useState(() => {
    const saved = localStorage.getItem('activeAdmin');
    return saved ? JSON.parse(saved) : null;
  });
  const [isMuted, setIsMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isApproved && peer) {
        socket.emit('join', { role: 'user', name: userName, peerId: peer.id });
    }

    socket.on('available-events', (admins: any[]) => setAvailableAdmins(admins));
    socket.on('participants-list', (list: any[]) => setAllParticipants(list.filter(p => p.role === 'user')));
    
    socket.on('join-approved', (data: any) => {
      localStorage.setItem('isApproved', 'true');
      localStorage.setItem('activeAdmin', JSON.stringify(data));
      setActiveAdminData(data);
      setIsApproved(true);
      socket.emit('join', { role: 'user', name: userName, peerId: peer.id });
    });

    socket.on('mic-granted', async ({ adminPeerId, targetPeerId }: any) => {
      if (peer.id === targetPeerId) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          stream.getAudioTracks()[0].enabled = !isMuted;
          peer.call(adminPeerId, stream);
          setStatus('on-air');
        } catch (e) { console.error(e); setStatus('idle'); }
      }
    });

    socket.on('mic-revoked', () => {
      setStatus('idle');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    });

    return () => { socket.off('available-events'); socket.off('join-approved'); };
  }, [socket, peer, isApproved, isMuted, userName]);

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    if (streamRef.current) streamRef.current.getAudioTracks()[0].enabled = !newMute;
  };

  if (!isApproved) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-10">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-2">Geo-Mic</h1>
          <div className="flex items-center justify-center gap-2 text-indigo-400">
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Поиск активных зон</span>
          </div>
        </div>

        <div className="w-full max-w-md space-y-4">
          {availableAdmins.map(admin => (
            <button 
              key={admin.peerId} 
              onClick={() => socket.emit('request-join', { name: userName, adminSocketId: admin.socketId, peerId: peer.id })}
              className="w-full p-8 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-between hover:bg-indigo-600/20 transition-all active:scale-95 group"
            >
              <div className="text-left">
                <p className="text-white font-bold text-xl">{admin.name}</p>
                <p className="text-indigo-400 text-[10px] font-black uppercase mt-1">Нажмите, чтобы войти</p>
              </div>
              <div className="w-14 h-14 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform"><MapPin size={24}/></div>
            </button>
          ))}
          {availableAdmins.length === 0 && (
            <div className="text-center py-20 bg-white/5 rounded-[3rem] border border-dashed border-white/10 opacity-30">
               <Clock size={40} className="mx-auto mb-4" />
               <p className="text-[10px] font-black uppercase tracking-widest">Администраторы не найдены</p>
            </div>
          )}
        </div>
        <button onClick={onExit} className="mt-16 text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><LogOut size={14}/> Назад</button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-between p-10">
      <div className="w-full max-w-xl flex items-center justify-between bg-white/5 p-5 rounded-[2.5rem] border border-white/10 backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"><ShieldCheck size={24}/></div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Вы в зоне</p>
            <p className="text-white font-bold text-lg leading-none">{activeAdminData?.adminName}</p>
          </div>
        </div>
        <button onClick={onExit} className="p-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all"><LogOut size={20}/></button>
      </div>

      <div className="flex flex-col items-center relative">
        <button 
          onClick={() => { if (status === 'idle') { setStatus('hand-raised'); socket.emit('raise-hand'); } }}
          className={`w-72 h-72 rounded-full border-[15px] transition-all duration-700 flex flex-col items-center justify-center relative z-10 ${
            status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_100px_rgba(239,68,68,0.4)]' : 
            status === 'hand-raised' ? 'bg-slate-900 border-slate-800' : 'bg-indigo-600 border-indigo-400 shadow-2xl active:scale-95'
          }`}
        >
          {status === 'on-air' ? <Radio size={64} className="animate-pulse" /> : <Mic size={64} />}
          <span className="font-black uppercase text-sm mt-3 tracking-widest">{status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'Ожидание' : 'В ЭФИРЕ'}</span>
          
          {status === 'on-air' && <div className="absolute inset-[-20px] rounded-full border border-red-500 animate-ping opacity-20"></div>}
        </button>

        {status === 'on-air' && (
          <button onClick={toggleMute} className={`mt-12 px-10 py-5 rounded-3xl font-black uppercase text-xs flex items-center gap-3 border transition-all ${isMuted ? 'bg-red-500 border-red-400 shadow-lg shadow-red-500/20' : 'bg-white/5 border-white/10'}`}>
            {isMuted ? <MicOff size={20}/> : <Mic size={20}/>} {isMuted ? 'Микрофон выкл' : 'Выключить мик'}
          </button>
        )}
      </div>

      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-4 justify-center opacity-40">
            <Users size={14}/>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Участники ({allParticipants.length})</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
            {allParticipants.map(p => (
                <div key={p.peerId} className={`px-4 py-2 rounded-full border text-[10px] font-bold ${p.isOnAir ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                    {p.name} {p.handRaised && '✋'}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ParticipantView;