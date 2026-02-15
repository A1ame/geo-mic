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
    // Получаем список доступных событий
    socket.on('available-events', (admins: any[]) => setAvailableAdmins(admins));

    if (isApproved && peer) {
      socket.emit('join', { 
        role: 'user', 
        name: userName, 
        peerId: peer.id, 
        handRaised: status === 'hand-raised',
        isOnAir: status === 'on-air' 
      });
      
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
      socket.off('join-approved');
      socket.off('mic-granted');
      socket.off('mic-revoked');
    };
  }, [peer, isApproved]);

  // Переподключение при смене ID админа (его перезагрузке)
  useEffect(() => {
    if (status === 'on-air' && activeAdminData?.adminPeerId && peer) {
        startStreaming(activeAdminData.adminPeerId);
    }
  }, [activeAdminData?.adminPeerId]);

  const startStreaming = async (adminId: string) => {
    try {
      if (streamRef.current) stopStreaming();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      stream.getAudioTracks()[0].enabled = !isMuted;
      peer.call(adminId, stream);
      setStatus('on-air');
    } catch (e) { setStatus('idle'); }
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

  // ЭКРАН 1: Выбор события
  if (!activeAdminData) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        <h2 className="text-2xl font-black uppercase mb-8 italic tracking-tighter text-indigo-500">Доступные события</h2>
        <div className="w-full max-w-sm space-y-4">
          {availableAdmins.length === 0 ? (
            <p className="text-center text-slate-500 animate-pulse">Поиск активных зон...</p>
          ) : (
            availableAdmins.map(admin => (
              <button
                key={admin.socketId}
                onClick={() => socket.emit('request-join', { adminSocketId: admin.socketId, name: userName, peerId: peer?.id })}
                className="w-full p-6 bg-white/5 border border-white/10 rounded-3xl flex justify-between items-center hover:bg-white/10 transition-all group"
              >
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase text-indigo-400">Администратор</p>
                  <p className="font-bold text-lg">{admin.name}</p>
                </div>
                <Users className="text-slate-600 group-hover:text-indigo-500 transition-colors" />
              </button>
            ))
          )}
        </div>
        <button onClick={onExit} className="mt-10 text-slate-500 text-[10px] font-black uppercase">Назад</button>
      </div>
    );
  }

  // ЭКРАН 2: Ожидание одобрения
  if (!isApproved) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center animate-bounce mb-6">
          <ShieldCheck size={40} />
        </div>
        <h2 className="text-xl font-bold mb-2">Запрос отправлен</h2>
        <p className="text-slate-400 text-sm">Ожидайте, пока <b>{activeAdminData.adminName}</b> подтвердит ваш вход</p>
        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="mt-8 text-[10px] font-black uppercase text-red-500">Отменить</button>
      </div>
    );
  }

  // ЭКРАН 3: Основной интерфейс
  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-between p-10 text-white">
      <div className="w-full max-w-md bg-white/5 p-4 rounded-3xl border border-white/10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-indigo-500"/>
          <span className="font-bold">{activeAdminData?.adminName}</span>
        </div>
        <button onClick={onExit} className="text-red-500 p-2"><LogOut size={20}/></button>
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
              {status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'Ждем микр.' : 'В ЭФИРЕ'}
          </span>
        </button>

        {status === 'on-air' && (
          <button onClick={toggleMute} className={`mt-10 px-8 py-4 rounded-2xl font-black uppercase text-[10px] flex items-center gap-3 border transition-all ${isMuted ? 'bg-red-500 border-red-400' : 'bg-white/5 border-white/10'}`}>
            {isMuted ? <MicOff size={16}/> : <Mic size={16}/>} {isMuted ? 'Звук выкл' : 'Выключить мик'}
          </button>
        )}
      </div>

      <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-20">Geo-Mic Protocol</div>
    </div>
  );
};

export default ParticipantView;