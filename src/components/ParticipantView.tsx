import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, ShieldAlert, MapPin } from 'lucide-react';

interface ParticipantProps {
  socket: any;
  peer: any;
  isInside: boolean;
  userName: string;
}

const ParticipantView: React.FC<ParticipantProps> = ({ socket, peer, isInside, userName }) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>('idle');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!socket || !peer) return;

    // Когда админ дает нам право голоса
    socket.on('mic-granted', async ({ targetPeerId, adminPeerId }: any) => {
      if (peer.id === targetPeerId) {
        try {
          setStatus('on-air');
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { 
              echoCancellation: true, 
              noiseSuppression: true, 
              autoGainControl: true 
            }
          });
          
          streamRef.current = stream;
          peer.call(adminPeerId, stream); 
        } catch (err) {
          console.error("Ошибка микрофона:", err);
          setStatus('idle');
        }
      }
    });

    // Когда админ забирает микрофон
    socket.on('mic-revoked', () => {
      setStatus('idle');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    });

    return () => {
      socket.off('mic-granted');
      socket.off('mic-revoked');
    };
  }, [socket, peer]);

  const handleRaiseHand = () => {
    if (status === 'idle' && peer?.id) {
      setStatus('hand-raised');
      socket.emit('raise-hand', { 
        name: userName, 
        peerId: peer.id, 
        socketId: socket.id 
      });
    }
  };

  // ЭКРАН: ВНЕ ЗОНЫ
  if (!isInside) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 p-10 text-center">
        <div className="w-full max-w-sm bg-red-500/5 border border-red-500/20 p-12 rounded-[3rem] backdrop-blur-2xl space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
            <ShieldAlert size={40} />
          </div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">ВНЕ ЗОНЫ</h2>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">
            Подойдите ближе к организатору, чтобы получить доступ к микрофону.
          </p>
          <div className="pt-4 flex justify-center items-center gap-2 text-red-500/50 text-[10px] font-black uppercase tracking-widest">
            <MapPin size={12} /> Поиск сигнала...
          </div>
        </div>
      </div>
    );
  }

  // ЭКРАН: ВНУТРИ ЗОНЫ
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 p-8 text-center space-y-16">
      <div className="relative group">
        {status === 'on-air' && (
          <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20 scale-125" />
        )}
        
        <button
          type="button"
          onClick={handleRaiseHand}
          disabled={status !== 'idle'}
          className={`relative w-72 h-72 rounded-full flex flex-col items-center justify-center transition-all duration-500 border-8 shadow-2xl ${
            status === 'on-air' 
              ? 'bg-red-600 border-red-400 scale-105 shadow-red-500/40' 
              : status === 'hand-raised'
              ? 'bg-slate-900 border-indigo-900 text-slate-500'
              : 'bg-indigo-600 border-indigo-400 hover:scale-[1.02] active:scale-95 shadow-indigo-500/20'
          }`}
        >
          {status === 'on-air' ? (
            <Radio size={48} className="text-white mb-4 animate-pulse" />
          ) : (
            <Mic size={48} className="text-white mb-4" />
          )}
          
          <span className="text-white font-black text-2xl tracking-tighter uppercase px-8 leading-tight">
            {status === 'idle' && "Просить слово"}
            {status === 'hand-raised' && "В очереди"}
            {status === 'on-air' && "Вы в эфире"}
          </span>
        </button>
      </div>

      <div className="space-y-4">
        <div className="h-1 w-12 bg-indigo-500/30 rounded-full mx-auto" />
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Пользователь</p>
        <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase">{userName}</h3>
      </div>
    </div>
  );
};

export default ParticipantView;