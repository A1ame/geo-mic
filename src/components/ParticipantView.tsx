import { useState, useEffect, useRef } from 'react';

const ParticipantView = ({ socket, peer, isInside, userName }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>('idle');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    socket.on('mic-granted', async ({ targetPeerId, adminPeerId }: any) => {
      if (peer.id === targetPeerId) {
        try {
          setStatus('on-air');
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
          streamRef.current = stream;
          peer.call(adminPeerId, stream); 
        } catch (err) {
          alert("Нет доступа к микрофону!");
          setStatus('idle');
        }
      }
    });

    socket.on('mic-revoked', () => {
      setStatus('idle');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    });

    return () => {
      socket.off('mic-granted');
      socket.off('mic-revoked');
    };
  }, [socket, peer]);

  if (!isInside) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 p-8 text-center">
        <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-3xl backdrop-blur-md">
          <div className="text-5xl mb-4">📍</div>
          <h2 className="text-2xl font-bold text-red-500 mb-2">Вы вне зоны</h2>
          <p className="text-slate-400">Подойдите ближе к организатору для участия</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 p-6">
      <div className={`w-64 h-64 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl ${
        status === 'on-air' ? 'bg-red-600 scale-110 shadow-red-500/50' : 'bg-blue-600 shadow-blue-500/50'
      }`}>
        <button
          onClick={() => {
            setStatus('hand-raised');
            socket.emit('raise-hand', { name: userName, peerId: peer.id });
          }}
          disabled={status !== 'idle'}
          className="text-white font-black text-2xl tracking-widest"
        >
          {status === 'idle' && "ПРОСИТЬ СЛОВО"}
          {status === 'hand-raised' && "В ОЧЕРЕДИ..."}
          {status === 'on-air' && "В ЭФИРЕ"}
        </button>
      </div>
      <div className="mt-12 text-center">
        <p className="text-slate-500 text-sm uppercase tracking-widest mb-1">Ваш профиль</p>
        <p className="text-white text-xl font-bold">{userName}</p>
      </div>
    </div>
  );
};

export default ParticipantView;