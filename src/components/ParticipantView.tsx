import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, ShieldAlert, MicOff, LogOut } from 'lucide-react';

const ParticipantView = ({ socket, peer, isInside, userName }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>(() => (localStorage.getItem('userStatus') as any) || 'idle');
  const [isMuted, setIsMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!socket || !peer) return;

    const updateLoc = () => {
      navigator.geolocation.getCurrentPosition((pos) => {
        socket.emit('update-coords', { coords: [pos.coords.latitude, pos.coords.longitude] });
      });
    };
    updateLoc();
    const interval = setInterval(updateLoc, 10000);

    socket.on('mic-granted', async ({ targetPeerId, adminPeerId }: any) => {
      if (peer.id === targetPeerId) {
        setStatus('on-air');
        localStorage.setItem('userStatus', 'on-air');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        peer.call(adminPeerId, stream);
      }
    });

    socket.on('mic-revoked', ({ targetPeerId }: any) => {
      if (peer.id === targetPeerId) {
        setStatus('idle');
        localStorage.setItem('userStatus', 'idle');
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      }
    });

    return () => { clearInterval(interval); socket.off('mic-granted'); socket.off('mic-revoked'); };
  }, [socket, peer]);

  const toggleMute = () => {
    if (streamRef.current) {
      const track = streamRef.current.getAudioTracks()[0];
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  };

  const handleLeave = () => {
    socket.emit('leave');
    localStorage.clear();
    window.location.reload();
  };

  if (!isInside) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 p-6 text-center">
      <ShieldAlert size={64} className="text-red-500 mb-6 animate-pulse" />
      <h2 className="text-2xl font-black text-white uppercase italic">Вы вне зоны</h2>
      <button onClick={handleLeave} className="mt-8 px-8 py-3 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase text-[10px]">Выйти</button>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 p-6 text-center">
      <button
        onClick={() => { if (status === 'idle') { setStatus('hand-raised'); localStorage.setItem('userStatus', 'hand-raised'); socket.emit('raise-hand', { name: userName, peerId: peer.id }); } }}
        className={`w-64 h-64 rounded-full flex flex-col items-center justify-center border-8 transition-all ${status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_50px_#ef4444]' : status === 'hand-raised' ? 'bg-slate-900 border-indigo-900 text-slate-600' : 'bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-500/20'}`}
      >
        {status === 'on-air' ? <Radio size={48} className="mb-2" /> : <Mic size={48} className="mb-2" />}
        <span className="font-black text-xl uppercase italic">{status === 'idle' ? 'Просить слово' : status === 'hand-raised' ? 'В очереди' : 'В эфире'}</span>
      </button>

      {status === 'on-air' && (
        <button onClick={toggleMute} className={`mt-8 flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase text-xs border transition-all ${isMuted ? 'bg-red-500 border-red-400' : 'bg-transparent border-white/20'}`}>
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />} {isMuted ? 'Микрофон выкл.' : 'Выкл. микрофон'}
        </button>
      )}

      <div className="mt-12 flex flex-col items-center">
        <h3 className="text-4xl font-black text-white italic uppercase mb-4">{userName}</h3>
        <button onClick={handleLeave} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] hover:text-white transition-all"><LogOut size={14}/> Покинуть событие</button>
      </div>
    </div>
  );
};

export default ParticipantView;