import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, ShieldAlert, MicOff, LogOut } from 'lucide-react';

const ParticipantView = ({ socket, peer, isInside, userName, onExit }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>(() => (localStorage.getItem('pStatus') as any) || 'idle');
  const [isMuted, setIsMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!socket || !peer) return;

    socket.on('mic-granted', async ({ targetPeerId, adminPeerId }: any) => {
      if (peer.id === targetPeerId) {
        try {
          setStatus('on-air');
          localStorage.setItem('pStatus', 'on-air');
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          peer.call(adminPeerId, stream);
        } catch (err) {
          console.error("Mic access denied", err);
          setStatus('idle');
        }
      }
    });

    socket.on('mic-revoked', ({ targetPeerId }: any) => {
      if (peer.id === targetPeerId) {
        stopStreaming();
      }
    });

    // Если админ удалил нас или сбросил статус через список
    socket.on('participants-list', (list: any[]) => {
      const me = list.find(p => p.name === userName);
      if (!me) return;
      if (!me.isOnAir && status === 'on-air') stopStreaming();
      if (!me.handRaised && status === 'hand-raised') {
          setStatus('idle');
          localStorage.setItem('pStatus', 'idle');
      }
    });

    return () => {
      socket.off('mic-granted');
      socket.off('mic-revoked');
      socket.off('participants-list');
    };
  }, [socket, peer, status]);

  const stopStreaming = () => {
    setStatus('idle');
    localStorage.setItem('pStatus', 'idle');
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
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <button
        onClick={() => {
          if (status === 'idle') {
            setStatus('hand-raised');
            localStorage.setItem('pStatus', 'hand-raised');
            socket.emit('raise-hand');
          }
        }}
        className={`w-64 h-64 rounded-full border-8 transition-all flex flex-col items-center justify-center ${
          status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_50px_#ef4444]' : 
          status === 'hand-raised' ? 'bg-slate-900 border-indigo-900 text-slate-400' : 
          'bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-500/20'
        }`}
      >
        {status === 'on-air' ? <Radio size={48} className="text-white mb-2"/> : <Mic size={48} className="text-white mb-2"/>}
        <span className="text-white font-black uppercase tracking-widest text-sm">
            {status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'Ждите...' : 'В ЭФИРЕ'}
        </span>
      </button>

      {status === 'on-air' && (
        <button onClick={toggleMute} className={`mt-8 flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase text-xs border transition-all ${isMuted ? 'bg-red-500 border-red-400' : 'bg-white/5 border-white/10 text-white'}`}>
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />} {isMuted ? 'Микрофон выкл.' : 'Выключить звук'}
        </button>
      )}

      <div className="mt-12 flex flex-col items-center">
        <h3 className="text-3xl font-black text-white italic uppercase mb-4">{userName}</h3>
        <button onClick={onExit} className="flex items-center gap-2 text-slate-600 font-black uppercase text-[10px] hover:text-white transition-all"><LogOut size={14}/> Покинуть событие</button>
      </div>
    </div>
  );
};

export default ParticipantView;