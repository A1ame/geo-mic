import { useState, useEffect, useRef } from 'react';

const ParticipantView = ({ socket, peer, isInside, userName }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>('idle');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!socket || !peer) return;

    // Когда админ дает нам право голоса
    socket.on('mic-granted', async ({ targetPeerId, adminPeerId }: any) => {
      // Проверяем, что микрофон дали именно нам
      if (peer.id === targetPeerId) {
        try {
          console.log("🎤 Микрофон разрешен, начинаем захват...");
          setStatus('on-air');
          
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { 
              echoCancellation: true, 
              noiseSuppression: true, 
              autoGainControl: true 
            }
          });
          
          streamRef.current = stream;
          
          // Звоним админу и передаем свой аудио-поток
          peer.call(adminPeerId, stream); 
          console.log("📡 Поток отправлен админу:", adminPeerId);
          
        } catch (err) {
          console.error("Ошибка доступа к микрофону:", err);
          alert("Не удалось включить микрофон. Проверьте разрешения в браузере.");
          setStatus('idle');
          socket.emit('mic-error', { peerId: peer.id });
        }
      }
    });

    // Когда админ забирает микрофон или мы выходим из зоны
    socket.on('mic-revoked', () => {
      console.log("🔇 Микрофон отключен админом");
      stopMic();
    });

    return () => {
      socket.off('mic-granted');
      socket.off('mic-revoked');
      stopMic();
    };
  }, [socket, peer]);

  const stopMic = () => {
    setStatus('idle');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log("Track stopped:", track.label);
      });
      streamRef.current = null;
    }
  };

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

  // Экран, если пользователь не в гео-зоне
  if (!isInside) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 p-8 text-center">
        <div className="bg-red-900/10 border border-red-500/30 p-10 rounded-[2.5rem] backdrop-blur-xl">
          <div className="text-6xl mb-6 animate-pulse">📍</div>
          <h2 className="text-2xl font-black text-white mb-3">ВЫ ВНЕ ЗОНЫ</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Чтобы попросить микрофон, вам нужно <br /> 
            находиться внутри круга на карте организатора.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 p-6 overflow-hidden">
      {/* Основная кнопка-индикатор */}
      <div className="relative">
        {status === 'on-air' && (
          <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20"></div>
        )}
        
        <button
          onClick={handleRaiseHand}
          disabled={status !== 'idle'}
          className={`relative w-64 h-64 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl border-4 ${
            status === 'on-air' 
              ? 'bg-red-600 border-red-400 scale-110 shadow-red-500/40' 
              : status === 'hand-raised'
              ? 'bg-slate-800 border-indigo-500 shadow-indigo-500/20 opacity-80'
              : 'bg-indigo-600 border-indigo-400 shadow-indigo-500/40 active:scale-95'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-white font-black text-xl tracking-tighter text-center px-4 uppercase leading-tight">
              {status === 'idle' && "ПРОСИТЬ СЛОВО"}
              {status === 'hand-raised' && "В ОЧЕРЕДИ"}
              {status === 'on-air' && "В ЭФИРЕ"}
            </span>
            {status === 'on-air' && <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>}
          </div>
        </button>
      </div>

      <div className="mt-16 flex flex-col items-center">
        <div className="h-1 w-8 bg-indigo-500/50 rounded-full mb-4"></div>
        <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] mb-1 font-bold">Спикер</p>
        <p className="text-white text-2xl font-black tracking-tight italic">{userName}</p>
        <div className="mt-4 flex items-center gap-2">
           <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
           <span className="text-slate-400 text-[10px] font-mono uppercase">Voice Ready</span>
        </div>
      </div>
    </div>
  );
};

export default ParticipantView;