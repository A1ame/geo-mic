import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, ShieldAlert, MicOff, LogOut, Users } from 'lucide-react';

const ParticipantView = ({ socket, peer, isInside, userName, adminData, onExit }: any) => {
  // Сбрасываем статус в idle при загрузке, чтобы не было фантомных очередей
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>('idle');
  const [participants, setParticipants] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!socket || !peer) return;

    const startCall = async (adminPeerId: string) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            peer.call(adminPeerId, stream);
            setStatus('on-air');
        } catch (err) {
            console.error("Mic access denied", err);
            setStatus('idle');
        }
    };

    socket.on('mic-granted', ({ targetPeerId, adminPeerId }: any) => {
      if (peer.id === targetPeerId) startCall(adminPeerId);
    });

    socket.on('mic-revoked', ({ targetPeerId }: any) => {
      if (peer.id === targetPeerId) stopStreaming();
    });

    // Логика восстановления: если админ перезагрузился и мы были в эфире
    socket.on('admin-updated', (newAdmin: any) => {
        if (status === 'on-air' && newAdmin.peerId) {
            // Перезваниваем админу по новому peerId
            if (streamRef.current) peer.call(newAdmin.peerId, streamRef.current);
        }
    });

    socket.on('participants-list', (list: any[]) => {
      setParticipants(list.filter(p => p.role === 'user' && p.name !== userName));
      const me = list.find(p => p.name === userName);
      if (me && !me.isOnAir && status === 'on-air') stopStreaming();
    });

    return () => {
      socket.off('mic-granted');
      socket.off('mic-revoked');
      socket.off('admin-updated');
      socket.off('participants-list');
    };
  }, [socket, peer, status, userName]);

  const stopStreaming = () => {
    setStatus('idle');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const track = streamRef.current.getAudioTracks()[0];
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  };

  if (!isInside) return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
      <ShieldAlert size={64} className="text-red-600 mb-6 animate-pulse" />
      <h2 className="text-2xl font-black uppercase italic">Вы вне зоны</h2>
      <button onClick={onExit} className="mt-8 px-10 py-3 bg-white/5 border border-white/10 rounded-2xl font-black uppercase text-[10px]">Выйти</button>
    </div>
  );

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-between py-12 px-6 overflow-hidden">
      {/* Шапка с названием события */}
      <div className="text-center">
        <p className="text-indigo-500 font-black text-[10px] uppercase tracking-[0.3em] mb-2">Событие от</p>
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter border-b-2 border-indigo-500 pb-2 inline-block">
            {adminData.name || "Загрузка..."}
        </h2>
      </div>

      {/* Кнопка микрофона */}
      <div className="flex flex-col items-center">
        <button
            onClick={() => {
            if (status === 'idle') {
                setStatus('hand-raised');
                socket.emit('raise-hand');
            }
            }}
            className={`w-60 h-60 rounded-full border-8 transition-all flex flex-col items-center justify-center ${
            status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_60px_#ef4444] scale-110' : 
            status === 'hand-raised' ? 'bg-slate-900 border-indigo-900 text-slate-500' : 
            'bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-500/30 active:scale-95'
            }`}
        >
            {status === 'on-air' ? <Radio size={48} className="text-white mb-2"/> : <Mic size={48} className="text-white mb-2"/>}
            <span className="text-white font-black uppercase tracking-widest text-xs">
                {status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'В очереди...' : 'В ЭФИРЕ'}
            </span>
        </button>

        {status === 'on-air' && (
            <button onClick={toggleMute} className={`mt-8 flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase text-xs border transition-all ${isMuted ? 'bg-red-500 border-red-400' : 'bg-white/5 border-white/10 text-white'}`}>
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />} {isMuted ? 'Микрофон выкл.' : 'Выключить звук'}
            </button>
        )}
      </div>

      {/* Список участников рядом */}
      <div className="w-full max-w-xs">
        <div className="flex items-center gap-2 mb-4 justify-center">
            <Users size={14} className="text-slate-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Участники рядом ({participants.length})</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
            {participants.map(p => (
                <div key={p.socketId} className="px-4 py-2 bg-white/5 rounded-full border border-white/5 text-[10px] font-bold text-slate-300">
                    {p.name} {p.handRaised ? '✋' : ''} {p.isOnAir ? '🎙️' : ''}
                </div>
            ))}
            {participants.length === 0 && <span className="text-[9px] text-slate-700 uppercase font-bold">Вы пока один в этой зоне</span>}
        </div>
        
        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col items-center">
            <span className="text-slate-400 font-bold mb-2">{userName}</span>
            <button onClick={onExit} className="text-slate-700 font-black uppercase text-[9px] hover:text-red-500 transition-all">Покинуть событие</button>
        </div>
      </div>
    </div>
  );
};

export default ParticipantView;