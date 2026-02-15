import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, ShieldAlert, MicOff } from 'lucide-react';

const ParticipantView = ({ socket, peer, isInside, userName }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>('idle');
  const [isMuted, setIsMuted] = useState(false); // Локальный Mute
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!socket || !peer) return;

    socket.on('mic-granted', async ({ targetPeerId, adminPeerId }: any) => {
      if (peer.id === targetPeerId) {
        try {
          setStatus('on-air');
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          peer.call(adminPeerId, stream);
        } catch (err) {
          setStatus('idle');
        }
      }
    });

    socket.on('mic-revoked', ({ targetPeerId }: any) => {
      if (peer.id === targetPeerId) {
        setStatus('idle');
        setIsMuted(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
      }
    });

    return () => {
      socket.off('mic-granted');
      socket.off('mic-revoked');
    };
  }, [socket, peer]);

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  if (!isInside) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 p-6 text-center">
        <div className="flex flex-col items-center">
          <ShieldAlert size={64} className="text-red-500 mb-6 animate-pulse" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Вы вне зоны</h2>
          <p className="text-slate-500 text-sm mt-2 uppercase font-bold tracking-widest">Подойдите ближе</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 p-6 text-center">
      <button
        onClick={() => {
          if (status === 'idle') {
            setStatus('hand-raised');
            socket.emit('raise-hand', { name: userName, peerId: peer.id });
          }
        }}
        disabled={status !== 'idle'}
        className={`w-64 h-64 rounded-full flex flex-col items-center justify-center transition-all duration-500 border-8 ${
          status === 'on-air' ? 'bg-red-600 border-red-400 animate-pulse shadow-[0_0_50px_#ef4444]' : 
          status === 'hand-raised' ? 'bg-slate-900 border-indigo-900 text-slate-600' : 
          'bg-indigo-600 border-indigo-400 active:scale-95 shadow-2xl shadow-indigo-500/20'
        }`}
      >
        {status === 'on-air' ? <Radio size={48} className="text-white mb-2" /> : <Mic size={48} className="text-white mb-2" />}
        <span className="text-white font-black text-xl uppercase tracking-tighter">
          {status === 'idle' ? 'Просить слово' : status === 'hand-raised' ? 'В очереди' : 'В эфире'}
        </span>
      </button>

      {status === 'on-air' && (
        <button 
          onClick={toggleMute}
          className={`mt-8 flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase text-xs transition-all border ${isMuted ? 'bg-red-500 border-red-400 text-white' : 'bg-transparent border-white/20 text-white'}`}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          {isMuted ? 'Микрофон выкл.' : 'Выключить микрофон'}
        </button>
      )}

      <div className="mt-12">
        <p className="text-slate-600 text-[10px] uppercase font-black tracking-[0.4em] mb-2">Speaker</p>
        <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">{userName}</h3>
      </div>
    </div>
  );
};

export default ParticipantView;