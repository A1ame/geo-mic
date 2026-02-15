import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, MicOff, MapPin, Clock, LogOut, ShieldCheck, RefreshCw, Users } from 'lucide-react';

const ParticipantView = ({ socket, peer, userName, onExit }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>('idle');
  const [availableAdmins, setAvailableAdmins] = useState<any[]>([]);
  const [allParticipants, setAllParticipants] = useState<any[]>([]);
  const [isApproved, setIsApproved] = useState(false);
  const [activeAdminData, setActiveAdminData] = useState<{name: string, peerId: string} | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    socket.emit('get-available-events');

    const pollInterval = setInterval(() => {
      if (!isApproved) socket.emit('get-available-events');
    }, 3000);

    socket.on('available-events', (admins: any[]) => setAvailableAdmins(admins));
    
    socket.on('participants-list', (list: any[]) => {
      setAllParticipants(list.filter(p => p.role === 'user'));
    });

    socket.on('join-approved', (data: any) => {
      setActiveAdminData({ name: data.adminName, peerId: data.adminPeerId });
      setIsApproved(true);
      // КРИТИЧЕСКИЙ ФИКС: Регистрируем участника в общем списке только ПОСЛЕ одобрения
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
        } catch (err) { console.error(err); }
      }
    });

    socket.on('mic-revoked', () => {
      setStatus('idle');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    });

    return () => {
      clearInterval(pollInterval);
      socket.off('available-events');
      socket.off('participants-list');
      socket.off('join-approved');
      socket.off('mic-granted');
      socket.off('mic-revoked');
    };
  }, [socket, peer, userName, isApproved, isMuted]);

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    if (streamRef.current) streamRef.current.getAudioTracks()[0].enabled = !newMute;
  };

  if (!isApproved) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-10">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter italic">Geo-Mic</h2>
          <div className="flex items-center justify-center gap-2 text-indigo-400 mt-2">
            <RefreshCw size={12} className="animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest">Поиск событий...</span>
          </div>
        </div>

        <div className="w-full max-w-md space-y-4">
          {availableAdmins.length > 0 ? availableAdmins.map(admin => (
            <button 
              key={admin.socketId} 
              onClick={() => socket.emit('request-join', { name: userName, adminSocketId: admin.socketId })}
              className="w-full p-6 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-between hover:bg-indigo-600/20 transition-all active:scale-95 group"
            >
              <div className="text-left">
                <p className="text-white font-bold text-lg">{admin.name}</p>
                <p className="text-indigo-400 text-[10px] font-black uppercase">Нажмите для запроса входа</p>
              </div>
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"><MapPin size={20} className="text-white"/></div>
            </button>
          )) : (
            <div className="text-center py-20 bg-white/5 rounded-[3rem] border border-dashed border-white/10 opacity-40">
              <Clock size={40} className="mx-auto mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest">Ожидание администратора</p>
            </div>
          )}
        </div>
        <button onClick={onExit} className="mt-12 text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><LogOut size={14}/> Выйти</button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-between p-8">
      <div className="w-full flex items-center justify-between bg-white/5 p-4 rounded-[2rem] border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><ShieldCheck size={20}/></div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Вы в зоне</p>
            <p className="text-white font-bold text-sm">{activeAdminData?.name}</p>
          </div>
        </div>
        <button onClick={onExit} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"><LogOut size={18}/></button>
      </div>

      <div className="flex flex-col items-center">
        <button 
          onClick={() => { if (status === 'idle') { setStatus('hand-raised'); socket.emit('raise-hand'); } }}
          className={`w-64 h-64 rounded-full border-[12px] transition-all duration-500 flex flex-col items-center justify-center relative ${
            status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_80px_rgba(239,68,68,0.4)] animate-pulse' : 
            status === 'hand-raised' ? 'bg-slate-900 border-slate-800' : 'bg-indigo-600 border-indigo-400 shadow-2xl active:scale-95'
          }`}
        >
          {status === 'on-air' ? <Radio size={56} className="text-white mb-2" /> : <Mic size={56} className="text-white mb-2" />}
          <span className="text-white font-black uppercase text-xs tracking-widest">{status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'Ожидание' : 'В ЭФИРЕ'}</span>
        </button>

        {status === 'on-air' && (
          <button onClick={toggleMute} className={`mt-8 px-8 py-4 rounded-2xl font-black uppercase text-[10px] flex items-center gap-3 border transition-all ${isMuted ? 'bg-red-500 border-red-400 text-white' : 'bg-white/5 border-white/10 text-white'}`}>
            {isMuted ? <MicOff size={16}/> : <Mic size={16}/>} {isMuted ? 'Звук выкл' : 'Выключить мик'}
          </button>
        )}
      </div>

      <div className="w-full max-w-xs">
        <div className="flex items-center gap-2 mb-3 justify-center opacity-40">
            <Users size={12}/>
            <span className="text-[10px] font-black uppercase tracking-widest">Участники в зоне ({allParticipants.length})</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
            {allParticipants.map(p => (
                <div key={p.socketId} className={`px-3 py-1.5 rounded-full border text-[9px] font-bold ${p.isOnAir ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                    {p.name} {p.handRaised && '✋'}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ParticipantView;