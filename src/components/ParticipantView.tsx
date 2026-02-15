import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, MicOff, LogOut, ShieldCheck } from 'lucide-react';

const ParticipantView = ({ socket, peer, userName, onExit }: any) => {
  // Инициализируем статус из памяти
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>(() => 
    (localStorage.getItem('pStatus') as any) || 'idle'
  );
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
    if (isApproved && peer) {
      // Сообщаем серверу о себе и сохраняем текущий статус (руку)
      socket.emit('join', { role: 'user', name: userName, peerId: peer.id, handRaised: status === 'hand-raised' });
      
      // Если мы были в эфире - пытаемся восстановить связь с админом
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

    return () => { socket.off('join-approved'); socket.off('mic-granted'); socket.off('mic-revoked'); };
  }, [peer, isApproved]);

  // ФИКС ПЕРЕЗАГРУЗКИ АДМИНА: перезвонить на новый ID автоматически
  useEffect(() => {
    if (status === 'on-air' && activeAdminData?.adminPeerId && peer) {
        startStreaming(activeAdminData.adminPeerId);
    }
  }, [activeAdminData?.adminPeerId]);

  const startStreaming = async (adminId: string) => {
    if (!adminId || !peer) return;
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

  if (!isApproved) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <h1 className="text-3xl font-black uppercase italic mb-8">Geo-Mic</h1>
        <button onClick={() => socket.emit('request-join', { name: userName, peerId: peer?.id })} className="bg-indigo-600 px-10 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all">
          Запросить вход
        </button>
        <button onClick={onExit} className="mt-8 text-slate-500 uppercase text-[10px] font-black">Назад</button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-between p-10 text-white">
      <div className="w-full max-w-md bg-white/5 p-4 rounded-3xl border border-white/10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-indigo-500"/>
          <span className="font-bold">{activeAdminData?.adminName}</span>
        </div>
        <button onClick={onExit} className="text-red-500 p-2"><LogOut size={20}/></button>
      </div>

      <button 
        onClick={handleMicRequest}
        disabled={status !== 'idle'}
        className={`w-64 h-64 rounded-full border-[12px] flex flex-col items-center justify-center transition-all duration-500 ${
          status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_80px_rgba(239,68,68,0.4)]' : 
          status === 'hand-raised' ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-indigo-600 border-indigo-400 shadow-2xl'
        }`}
      >
        {status === 'on-air' ? <Radio size={56} className="animate-pulse" /> : <Mic size={56} />}
        <span className="font-black uppercase text-xs mt-4 tracking-widest">
            {status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'Ожидание' : 'В ЭФИРЕ'}
        </span>
      </button>

      <div className="text-center opacity-30 text-[10px] font-black uppercase tracking-widest">
        {status === 'on-air' ? 'Вас слышит админ' : 'Микрофон выключен'}
      </div>
    </div>
  );
};

export default ParticipantView;