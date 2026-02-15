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

  // Сохраняем статус для восстановления после F5
  useEffect(() => {
    localStorage.setItem('pStatus', status);
  }, [status]);

  const startStreaming = async (adminId: string) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      stream.getAudioTracks()[0].enabled = !isMuted;
      
      console.log("Звоним администратору:", adminId);
      peer.call(adminId, stream);
      setStatus('on-air');
    } catch (e) {
      console.error("Доступ к микрофону запрещен:", e);
      setStatus('idle');
    }
  };

  useEffect(() => {
    socket.on('available-events', (admins: any[]) => {
      setAvailableAdmins(admins);
      
      // Если админ перезагрузился, у него новый Peer ID. Обновляем и перезваниваем.
      if (isApproved && activeAdminData) {
        const currentAdmin = admins.find(a => a.name === activeAdminData.adminName);
        if (currentAdmin && currentAdmin.peerId !== activeAdminData.adminPeerId) {
          console.log("У админа новый ID, переподключаемся...");
          const updated = { ...activeAdminData, adminPeerId: currentAdmin.peerId, adminSocketId: currentAdmin.socketId };
          setActiveAdminData(updated);
          localStorage.setItem('activeAdmin', JSON.stringify(updated));
          
          if (status === 'on-air') startStreaming(currentAdmin.peerId);
        }
      }
    });

    socket.on('event-ended', (data: any) => {
      if (activeAdminData && data.adminSocketId === activeAdminData.adminSocketId) {
        alert("Администратор завершил событие");
        onExit();
      }
    });

    if (isApproved && peer) {
      socket.emit('join', { 
        role: 'user', 
        name: userName, 
        peerId: peer.id, 
        isOnAir: status === 'on-air' 
      });

      // Если мы обновили страницу и были в эфире - сразу звоним админу
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
      if (peer.id === targetPeerId) {
        startStreaming(adminPeerId);
      }
    });

    socket.on('mic-revoked', () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setStatus('idle');
    });

    return () => {
      socket.off('available-events');
      socket.off('event-ended');
      socket.off('join-approved');
      socket.off('mic-granted');
      socket.off('mic-revoked');
    };
  }, [peer, isApproved, activeAdminData?.adminPeerId]);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (streamRef.current) {
      streamRef.current.getAudioTracks()[0].enabled = !nextMuted;
    }
  };

  if (!activeAdminData) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        <h2 className="text-xl font-black uppercase mb-8 text-indigo-500 tracking-widest">Активные события</h2>
        <div className="w-full max-w-sm space-y-4">
          {availableAdmins.map(admin => (
            <button key={admin.socketId} onClick={() => socket.emit('request-join', { adminSocketId: admin.socketId, name: userName, peerId: peer?.id })} className="w-full p-6 bg-white/5 border border-white/10 rounded-3xl flex justify-between items-center hover:bg-indigo-600/10 transition-all group">
              <div className="text-left">
                <p className="text-[10px] font-black uppercase text-indigo-400">Организатор</p>
                <p className="font-bold text-lg group-hover:text-indigo-400 transition-colors">{admin.name}</p>
              </div>
              <Users className="text-slate-600 group-hover:text-indigo-500" />
            </button>
          ))}
          {availableAdmins.length === 0 && <p className="text-center text-slate-500 text-sm">Пока нет доступных событий...</p>}
        </div>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center animate-bounce mb-6 shadow-[0_0_40px_rgba(79,70,229,0.4)]">
          <ShieldCheck size={40} />
        </div>
        <h2 className="text-xl font-bold mb-2">Запрос отправлен</h2>
        <p className="text-slate-400 text-sm">Ожидайте, пока <b>{activeAdminData.adminName}</b> подтвердит ваше участие</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-between p-10 text-white">
      <div className="w-full max-w-md bg-white/5 p-4 rounded-3xl border border-white/10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="font-bold text-sm tracking-tight">{activeAdminData?.adminName}</span>
        </div>
        <button onClick={onExit} className="text-slate-500 hover:text-red-500 p-2 transition-colors">
          <LogOut size={20}/>
        </button>
      </div>

      <div className="flex flex-col items-center">
        <button 
          onClick={() => { if(status === 'idle') { setStatus('hand-raised'); socket.emit('raise-hand'); } }}
          disabled={status !== 'idle'}
          className={`w-64 h-64 rounded-full border-[12px] flex flex-col items-center justify-center transition-all duration-500 ${
            status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_80px_rgba(239,68,68,0.4)]' : 
            status === 'hand-raised' ? 'bg-slate-900 border-indigo-900 text-indigo-400 animate-pulse' : 'bg-indigo-600 border-indigo-400 shadow-2xl hover:scale-105 active:scale-95'
          }`}
        >
          {status === 'on-air' ? <Radio size={56} className="animate-pulse" /> : <Mic size={56} />}
          <span className="font-black uppercase text-xs mt-4 tracking-widest">
              {status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'Ждем микр.' : 'В эфире'}
          </span>
        </button>

        {status === 'on-air' && (
          <button onClick={toggleMute} className={`mt-10 px-8 py-4 rounded-2xl font-black uppercase text-[10px] flex items-center gap-3 border transition-all ${isMuted ? 'bg-red-500 border-red-400' : 'bg-white/5 border-white/10'}`}>
            {isMuted ? <MicOff size={16}/> : <Mic size={16}/>} {isMuted ? 'Звук выключен' : 'Выключить мик'}
          </button>
        )}
      </div>

      <div className="opacity-10 text-[10px] font-black uppercase tracking-[0.5em] select-none">Geo-Mic Connection</div>
    </div>
  );
};

export default ParticipantView;