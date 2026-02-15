import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, MicOff, LogOut, ShieldCheck, Users } from 'lucide-react';

const ParticipantView = ({ socket, peer, userName, onExit }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>(() => 
    (localStorage.getItem('pStatus') as any) || 'idle'
  );
  const [availableAdmins, setAvailableAdmins] = useState<any[]>([]);
  const [isApproved, setIsApproved] = useState(() => localStorage.getItem('isApproved') === 'true');
  const [activeAdminData, setActiveAdminData] = useState<any>(() => {
    const saved = localStorage.getItem('activeAdmin');
    return saved ? JSON.parse(saved) : null;
  });
  const [isMuted, setIsMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    localStorage.setItem('pStatus', status);
  }, [status]);

  useEffect(() => {
    socket.on('available-events', (admins: any[]) => {
      setAvailableAdmins(admins);
      // Если админ обновил страницу, его Peer ID изменится в списке available-events
      if (isApproved && activeAdminData) {
        const currentAdmin = admins.find(a => a.name === activeAdminData.adminName);
        if (currentAdmin && currentAdmin.peerId !== activeAdminData.adminPeerId) {
          const newData = { ...activeAdminData, adminPeerId: currentAdmin.peerId, adminSocketId: currentAdmin.socketId };
          setActiveAdminData(newData);
          localStorage.setItem('activeAdmin', JSON.stringify(newData));
        }
      }
    });

    // ЛОГИКА ВЫХОДА: если админ закрыл событие
    socket.on('event-ended', (data: any) => {
        if (activeAdminData && data.adminSocketId === activeAdminData.adminSocketId) {
            alert("Администратор завершил событие");
            onExit(); // Вызываем очистку и релоад из App.tsx
        }
    });

    if (isApproved && peer) {
      socket.emit('join', { 
        role: 'user', 
        name: userName, 
        peerId: peer.id, 
        handRaised: status === 'hand-raised',
        isOnAir: status === 'on-air' 
      });
      // Если мы в эфире (после F5 участника), начинаем стрим немедленно
      if (status === 'on-air' && activeAdminData?.adminPeerId) {
        startStreaming(activeAdminData.adminPeerId);
      }
    }

    socket.on('join-approved', (data: any) => {
      localStorage.setItem('isApproved', 'true');
      localStorage.setItem('activeAdmin', JSON.stringify(data));
      setActiveAdminData(data);
      setIsApproved(true);
    });

    socket.on('mic-granted', ({ adminPeerId, targetPeerId }: any) => {
      if (peer.id === targetPeerId) startStreaming(adminPeerId);
    });

    socket.on('mic-revoked', () => {
      stopStreaming();
      setStatus('idle');
    });

    return () => { 
        socket.off('available-events'); 
        socket.off('event-ended');
        socket.off('mic-granted'); 
        socket.off('mic-revoked'); 
    };
  }, [peer, isApproved, activeAdminData?.adminPeerId]);

  // АВТО-ПЕРЕПОДКЛЮЧЕНИЕ: Если ID админа изменился (он нажал F5), а мы в эфире
  useEffect(() => {
    if (status === 'on-air' && activeAdminData?.adminPeerId && peer) {
        console.log("Re-initiating stream to new Admin Peer ID...");
        startStreaming(activeAdminData.adminPeerId);
    }
  }, [activeAdminData?.adminPeerId]);

  const startStreaming = async (adminId: string) => {
    try {
      if (streamRef.current) stopStreaming();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      stream.getAudioTracks()[0].enabled = !isMuted;
      
      const call = peer.call(adminId, stream);
      setStatus('on-air');
      
      call.on('error', (err: any) => {
          console.error("Peer call error, retrying...");
          setTimeout(() => { if (status === 'on-air') startStreaming(adminId); }, 2000);
      });
    } catch (e) { 
        console.error("Mic access error:", e);
        setStatus('idle'); 
    }
  };

  const stopStreaming = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const handleMicRequest = () => {
    if (status === 'idle') {
      setStatus('hand-raised');
      socket.emit('raise-hand');
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (streamRef.current) streamRef.current.getAudioTracks()[0].enabled = !nextMuted;
  };

  if (!activeAdminData) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        <h2 className="text-2xl font-black uppercase mb-8 text-indigo-500">Доступные события</h2>
        <div className="w-full max-w-sm space-y-4">
          {availableAdmins.map(admin => (
            <button key={admin.socketId} onClick={() => socket.emit('request-join', { adminSocketId: admin.socketId, name: userName, peerId: peer?.id })} className="w-full p-6 bg-white/5 border border-white/10 rounded-3xl flex justify-between items-center hover:bg-white/10 transition-all group">
              <div className="text-left">
                <p className="text-[10px] font-black uppercase text-indigo-400">Админ</p>
                <p className="font-bold text-lg">{admin.name}</p>
              </div>
              <Users className="text-slate-600 group-hover:text-indigo-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center animate-bounce mb-6"><ShieldCheck size={40} /></div>
        <h2 className="text-xl font-bold mb-2">Ожидание...</h2>
        <p className="text-slate-400 text-sm">Администратор <b>{activeAdminData.adminName}</b> должен подтвердить вход</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-between p-10 text-white">
      <div className="w-full max-w-md bg-white/5 p-4 rounded-3xl border border-white/10 flex justify-between items-center">
        <div className="flex items-center gap-3"><ShieldCheck className="text-indigo-500"/><span className="font-bold">{activeAdminData?.adminName}</span></div>
        <button onClick={onExit} className="text-red-500 p-2 hover:bg-red-500/10 rounded-full transition-all"><LogOut size={20}/></button>
      </div>

      <div className="flex flex-col items-center">
        <button 
          onClick={handleMicRequest}
          disabled={status !== 'idle'}
          className={`w-64 h-64 rounded-full border-[12px] flex flex-col items-center justify-center transition-all duration-500 ${
            status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_80px_rgba(239,68,68,0.4)]' : 
            status === 'hand-raised' ? 'bg-slate-900 border-indigo-900 text-indigo-400 animate-pulse' : 'bg-indigo-600 border-indigo-400 shadow-2xl'
          }`}
        >
          {status === 'on-air' ? <Radio size={56} className="animate-pulse" /> : <Mic size={56} />}
          <span className="font-black uppercase text-xs mt-4 tracking-widest">
              {status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'Ожидание' : 'В ЭФИРЕ'}
          </span>
        </button>

        {status === 'on-air' && (
          <button onClick={toggleMute} className={`mt-10 px-8 py-4 rounded-2xl font-black uppercase text-[10px] flex items-center gap-3 border transition-all ${isMuted ? 'bg-red-500 border-red-400' : 'bg-white/5 border-white/10'}`}>
            {isMuted ? <MicOff size={16}/> : <Mic size={16}/>} {isMuted ? 'Звук выкл' : 'Выключить мик'}
          </button>
        )}
      </div>
      <div className="opacity-10 text-[10px] font-black uppercase tracking-[0.5em]">Geo-Mic protocol</div>
    </div>
  );
};

export default ParticipantView;