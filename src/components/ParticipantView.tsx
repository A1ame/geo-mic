import { useState, useEffect, useRef } from 'react'; [cite: 76]
import { Mic, Radio, ShieldAlert, MapPin } from 'lucide-react';

const ParticipantView = ({ socket, peer, isInside, userName }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>('idle'); [cite: 76, 77]
  const streamRef = useRef<MediaStream | null>(null); [cite: 77]

  useEffect(() => {
    if (!socket || !peer) return; [cite: 77]

    socket.on('mic-granted', async ({ targetPeerId, adminPeerId }: any) => { [cite: 77]
      if (peer.id === targetPeerId) { [cite: 77]
        try {
          setStatus('on-air'); [cite: 77]
          const stream = await navigator.mediaDevices.getUserMedia({ [cite: 78]
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } [cite: 78]
          }); [cite: 79]
          streamRef.current = stream; [cite: 79]
          peer.call(adminPeerId, stream); [cite: 79]
        } catch (err) {
          console.error("Ошибка микрофона:", err); [cite: 80]
          setStatus('idle'); [cite: 81]
        }
      }
    });

    socket.on('mic-revoked', () => { [cite: 81]
      setStatus('idle'); [cite: 82]
      if (streamRef.current) { [cite: 82]
        streamRef.current.getTracks().forEach(t => t.stop()); [cite: 82]
        streamRef.current = null; [cite: 82]
      }
    });

    return () => {
      socket.off('mic-granted'); [cite: 81]
      socket.off('mic-revoked'); [cite: 82]
    };
  }, [socket, peer]);

  const handleRaiseHand = () => {
    if (status === 'idle' && peer?.id) { [cite: 82]
      setStatus('hand-raised'); [cite: 83]
      socket.emit('raise-hand', { name: userName, peerId: peer.id, socketId: socket.id }); [cite: 83]
    }
  };

  if (!isInside) { [cite: 83]
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 p-10 text-center">
        <div className="w-full max-w-sm bg-red-500/5 border border-red-500/20 p-12 rounded-[3rem] backdrop-blur-2xl space-y-6"> [cite: 83]
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
            <ShieldAlert size={40} /> [cite: 84]
          </div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">ВЫ ВНЕ ЗОНЫ</h2> [cite: 84]
          <p className="text-slate-500 text-sm font-medium leading-relaxed"> [cite: 84]
            Чтобы попросить микрофон, вам нужно находиться внутри круга на карте организатора. [cite: 85]
          </p>
          <div className="pt-4 flex justify-center items-center gap-2 text-red-500/50 text-[10px] font-black uppercase tracking-widest">
            <MapPin size={12} /> Ожидание сигнала...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 p-8 text-center space-y-16"> [cite: 86]
      <div className="relative group">
        {status === 'on-air' && ( [cite: 86]
          <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20 scale-125" /> [cite: 86]
        )}
        
        <button
          onClick={handleRaiseHand} [cite: 86]
          disabled={status !== 'idle'} [cite: 87]
          className={`relative w-72 h-72 rounded-full flex flex-col items-center justify-center transition-all duration-500 border-8 shadow-2xl ${ [cite: 87]
            status === 'on-air' 
              ? 'bg-red-600 border-red-400 scale-105 shadow-red-500/40' [cite: 87]
              : status === 'hand-raised'
              ? 'bg-slate-900 border-indigo-900 text-slate-500' [cite: 87]
              : 'bg-indigo-600 border-indigo-400 hover:scale-[1.02] active:scale-95 shadow-indigo-500/20' [cite: 88]
          }`}
        >
          {status === 'on-air' ? <Radio size={48} className="text-white mb-4 animate-pulse" /> : <Mic size={48} className="text-white mb-4" />}
          <span className="text-white font-black text-2xl tracking-tighter uppercase px-8 leading-tight"> [cite: 88]
            {status === 'idle' && "Просить слово"} [cite: 88]
            {status === 'hand-raised' && "В очереди"} [cite: 89]
            {status === 'on-air' && "Вы в эфире"} [cite: 89]
          </span>
        </button>
      </div>

      <div className="space-y-4"> [cite: 89]
        <div className="h-1 w-12 bg-indigo-500/30 rounded-full mx-auto" /> [cite: 90]
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Ваш статус</p> [cite: 90]
        <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase">{userName}</h3> [cite: 90]
      </div>
    </div>
  );
};

export default ParticipantView;