import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, MicOff, LogOut, ShieldCheck, Users } from 'lucide-react';

const ParticipantView = ({ socket, peer, userName, onExit }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>('idle');
  const [availableAdmins, setAvailableAdmins] = useState<any[]>([]);
  const [allParticipants, setAllParticipants] = useState<any[]>([]);
  const [isApproved, setIsApproved] = useState(() => localStorage.getItem('isApproved') === 'true');
  const [activeAdminData, setActiveAdminData] = useState<any>(() => {
    const saved = localStorage.getItem('activeAdmin');
    return saved ? JSON.parse(saved) : null;
  });
  const [isMuted, setIsMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // 18-21 СТРОКИ: Исправляем через проверку и вспомогательную функцию
  useEffect(() => {
    // Если статус "в эфире", данные админа есть и Peer инициализирован
    if (status === 'on-air' && activeAdminData?.adminPeerId && peer) {
        startStreaming(activeAdminData.adminPeerId);
    }
  }, [activeAdminData?.adminPeerId, status, peer]); 

  useEffect(() => {
    if (isApproved && peer) {
      socket.emit('join', { role: 'user', name: userName, peerId: peer.id });
    }

    socket.on('available-events', (admins: any[]) => setAvailableAdmins(admins));
    socket.on('participants-list', (list: any[]) => setAllParticipants(list.filter((p: any) => p.role === 'user')));
    
    socket.on('join-approved', (data: any) => {
      localStorage.setItem('isApproved', 'true');
      localStorage.setItem('activeAdmin', JSON.stringify(data));
      setActiveAdminData(data);
      setIsApproved(true);
      if (peer) socket.emit('join', { role: 'user', name: userName, peerId: peer.id });
    });

    socket.on('mic-granted', ({ adminPeerId, targetPeerId }: any) => {
      if (peer?.id === targetPeerId) startStreaming(adminPeerId);
    });

    socket.on('mic-revoked', () => {
      setStatus('idle');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    });

    return () => {
      socket.off('available-events');
      socket.off('participants-list');
      socket.off('join-approved');
      socket.off('mic-granted');
      socket.off('mic-revoked');
    };
  }, [socket, peer, isApproved, userName]);

  const startStreaming = async (adminPeerId: string) => {
    if (!adminPeerId || !peer) return; // Защита от пустого ID
    
    try {
      // Останавливаем старый поток, если он был
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Применяем Mute если нужно
      stream.getAudioTracks()[0].enabled = !isMuted;
      
      peer.call(adminPeerId, stream);
      setStatus('on-air');
    } catch (e) {
      console.error("Ошибка доступа к микрофону:", e);
      setStatus('idle');
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (streamRef.current) {
      streamRef.current.getAudioTracks()[0].enabled = !nextMuted;
    }
  };

  const handleRaiseHand = () => {
    if (status === 'idle') {
      setStatus('hand-raised');
      socket.emit('raise-hand');
    }
  };

  if (!isApproved) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-10">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl mb-8 rotate-3">
          <Radio size={40} className="text-white" />
        </div>
        <h1 className="text-4xl font-black uppercase italic mb-10 tracking-tighter text-white">Доступные зоны</h1>
        <div className="w-full max-w-md space-y-4">
          {availableAdmins.map(admin => (
            <button 
              key={admin.socketId} 
              onClick={() => socket.emit('request-join', { adminSocketId: admin.socketId, name: userName, peerId: peer?.id })}
              className="w-full p-6 bg-white/5 border border-white/10 rounded-3xl flex justify-between items-center hover:bg-indigo-600/20 transition-all group"
            >
              <span className="font-bold text-lg text-white">{admin.name}</span>
              <span className="text-[9px] font-black uppercase bg-indigo-600 px-4 py-2 rounded-full text-white group-hover:scale-110 transition-transform">Войти</span>
            </button>
          ))}
          {availableAdmins.length === 0 && (
            <div className="text-center p-10 border border-dashed border-white/10 rounded-3xl">
               <p className="text-slate-500 uppercase text-[10px] font-black tracking-widest">Трансляции не найдены</p>
            </div>
          )}
        </div>
        <button onClick={onExit} className="mt-10 text-slate-600 text-[10px] font-black uppercase hover:text-white transition-colors">Назад в меню</button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-between p-10 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/10 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldCheck size={20} className="text-white"/>
          </div>
          <div>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Вы в зоне</p>
            <p className="font-bold text-sm text-white">{activeAdminData?.adminName || 'Админ'}</p>
          </div>
        </div>
        <button onClick={onExit} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><LogOut size={18}/></button>
      </div>

      <div className="flex flex-col items-center z-10">
        <button 
          onClick={handleRaiseHand}
          disabled={status !== 'idle'}
          className={`relative w-64 h-64 rounded-full border-[12px] flex flex-col items-center justify-center transition-all duration-500 ${
            status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_80px_rgba(239,68,68,0.4)]' : 
            status === 'hand-raised' ? 'bg-slate-900 border-slate-800 text-slate-500 scale-95' : 
            'bg-indigo-600 border-indigo-400 shadow-2xl hover:scale-105 active:scale-95'
          }`}
        >
          {status === 'on-air' ? <Radio size={56} className="animate-pulse text-white" /> : <Mic size={56} className="text-white" />}
          <span className="font-black uppercase text-xs mt-4 tracking-widest text-white">
            {status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'Ждем админа' : 'В ЭФИРЕ'}
          </span>
          {status === 'on-air' && (
             <div className="absolute -inset-4 border border-red-500 rounded-full animate-ping opacity-20"></div>
          )}
        </button>

        {status === 'on-air' && (
          <button 
            onClick={toggleMute} 
            className={`mt-10 px-8 py-4 rounded-2xl font-black uppercase text-[10px] border transition-all flex items-center gap-3 ${
              isMuted ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/20' : 'bg-white/5 border-white/10 text-white'
            }`}
          >
            {isMuted ? <MicOff size={16}/> : <Mic size={16}/>}
            {isMuted ? 'Звук выключен' : 'Выключить мик'}
          </button>
        )}
      </div>

      <div className="flex flex-col items-center opacity-40 z-10">
        <div className="flex items-center gap-2 mb-2">
            <Users size={12} className="text-white"/> 
            <span className="text-[10px] font-black uppercase text-white tracking-widest">Участники ({allParticipants.length})</span>
        </div>
        <div className="flex gap-1.5">
          {allParticipants.length > 0 ? (
             allParticipants.slice(0, 6).map((p, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${p.isOnAir ? 'bg-red-500' : 'bg-white'}`}></div>
             ))
          ) : (
            <div className="w-1.5 h-1.5 bg-white/20 rounded-full"></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParticipantView;