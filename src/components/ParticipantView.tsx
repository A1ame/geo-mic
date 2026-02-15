import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, MicOff, LogOut, ShieldCheck } from 'lucide-react';

const ParticipantView = ({ socket, peer, userName, onExit }: any) => {
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

  // Синхронизация статуса с хранилищем
  useEffect(() => {
    localStorage.setItem('pStatus', status);
  }, [status]);

  useEffect(() => {
    if (isApproved && peer) {
      // При подключении/перезагрузке отправляем текущее состояние серверу
      socket.emit('join', { 
        role: 'user', 
        name: userName, 
        peerId: peer.id, 
        handRaised: status === 'hand-raised',
        isOnAir: status === 'on-air'
      });
      
      // Если до перезагрузки мы говорили — восстанавливаем звонок
      if (status === 'on-air' && activeAdminData?.adminPeerId) {
        startStreaming(activeAdminData.adminPeerId);
      }
    }

    socket.on('mic-granted', ({ adminPeerId, targetPeerId }: any) => {
      if (peer.id === targetPeerId) startStreaming(adminPeerId);
    });

    socket.on('mic-revoked', () => {
      stopStreaming();
      setStatus('idle');
    });

    socket.on('join-approved', (data: any) => {
      localStorage.setItem('isApproved', 'true');
      localStorage.setItem('activeAdmin', JSON.stringify(data));
      setActiveAdminData(data);
      setIsApproved(true);
    });

    return () => { 
        socket.off('mic-granted'); 
        socket.off('mic-revoked'); 
        socket.off('join-approved'); 
    };
  }, [peer, isApproved]);

  // ЭФФЕКТ: Если админ перезагрузился (изменился adminPeerId), а мы были в эфире — перезваниваем на новый ID
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
    } catch (e) { 
      console.error("Mic error:", e);
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
    if (streamRef.current) {
        streamRef.current.getAudioTracks()[0].enabled = !nextMuted;
    }
  };

  if (!isApproved) return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-10 text-white">
      <button onClick={() => socket.emit('request-join', { name: userName, peerId: peer?.id })} className="bg-indigo-600 px-10 py-5 rounded-2xl font-black uppercase shadow-xl hover:bg-indigo-500 transition-all">
        Запросить вход
      </button>
    </div>
  );

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-between p-10 text-white">
      <div className="w-full max-w-md bg-white/5 p-4 rounded-3xl border border-white/10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-indigo-500"/>
          <span className="font-bold text-sm truncate">{activeAdminData?.adminName}</span>
        </div>
        <button onClick={onExit} className="text-red-500 p-2 hover:bg-red-500/10 rounded-full transition-all">
            <LogOut size={20}/>
        </button>
      </div>

      <div className="flex flex-col items-center">
        <button 
          onClick={handleMicRequest}
          disabled={status !== 'idle'}
          className={`w-64 h-64 rounded-full border-[12px] flex flex-col items-center justify-center transition-all duration-500 ${
            status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_80px_rgba(239,68,68,0.4)]' : 
            status === 'hand-raised' ? 'bg-slate-900 border-slate-800 text-slate-500 animate-pulse' : 'bg-indigo-600 border-indigo-400 shadow-2xl'
          }`}
        >
          {status === 'on-air' ? <Radio size={56} className="animate-pulse" /> : <Mic size={56} />}
          <span className="font-black uppercase text-xs mt-4 tracking-widest">
              {status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'Ожидание' : 'В ЭФИРЕ'}
          </span>
        </button>

        {status === 'on-air' && (
          <button 
            onClick={toggleMute} 
            className={`mt-10 px-8 py-4 rounded-2xl font-black uppercase text-[10px] flex items-center gap-3 border transition-all ${isMuted ? 'bg-red-500 border-red-400' : 'bg-white/5 border-white/10'}`}
          >
            {isMuted ? <MicOff size={16}/> : <Mic size={16}/>} {isMuted ? 'Микрофон выкл' : 'Выключить звук'}
          </button>
        )}
      </div>

      <div className="opacity-20 text-[10px] font-black uppercase tracking-widest">Geo-Mic Protocol Active</div>
    </div>
  );
};

export default ParticipantView;