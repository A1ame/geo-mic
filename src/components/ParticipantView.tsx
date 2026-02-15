import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, MicOff, MapPin, Clock } from 'lucide-react';

const ParticipantView = ({ socket, peer, userName, onExit }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>('idle');
  const [availableAdmins, setAvailableAdmins] = useState<any[]>([]);
  const [isApproved, setIsApproved] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Немедленно запрашиваем список при монтировании
    socket.emit('get-available-events'); 
    
    socket.on('available-events', (admins: any[]) => {
      setAvailableAdmins(admins);
    });

    socket.on('join-approved', () => {
      setIsApproved(true);
      socket.emit('join', { role: 'user', name: userName, peerId: peer.id });
    });

    socket.on('mic-granted', async ({ adminPeerId, targetPeerId }: any) => {
      if (peer.id === targetPeerId) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        stream.getAudioTracks()[0].enabled = !isMuted;
        peer.call(adminPeerId, stream);
        setStatus('on-air');
      }
    });

    socket.on('mic-revoked', () => {
      setStatus('idle');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    });

    return () => { socket.off('available-events'); socket.off('join-approved'); };
  }, [socket, peer, userName]);

  if (!isApproved) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-10">
        <h2 className="text-3xl font-black text-white uppercase italic mb-10 tracking-tighter">Найти событие</h2>
        <div className="w-full max-w-md space-y-4">
          {availableAdmins.length > 0 ? availableAdmins.map(admin => (
            <button key={admin.socketId} onClick={() => socket.emit('request-join', { name: userName, adminSocketId: admin.socketId })}
              className="w-full p-6 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-between hover:bg-indigo-600/20 hover:border-indigo-500/50 transition-all active:scale-95 group">
              <div className="text-left">
                <p className="text-white font-bold text-lg">{admin.name}</p>
                <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">Трансляция активна</p>
              </div>
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors"><MapPin size={20} className="text-white"/></div>
            </button>
          )) : (
            <div className="text-center py-20 opacity-40">
              <Clock size={40} className="mx-auto mb-4 animate-spin-slow text-indigo-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Сканирование эфира...</p>
            </div>
          )}
        </div>
        <button onClick={onExit} className="mt-12 text-slate-700 hover:text-slate-400 font-black uppercase text-[10px] tracking-widest transition-colors">Отмена</button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <button onClick={() => { if (status === 'idle') { setStatus('hand-raised'); socket.emit('raise-hand'); } }}
        className={`w-72 h-72 rounded-full border-[12px] transition-all duration-500 flex flex-col items-center justify-center ${
          status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_80px_rgba(239,68,68,0.4)] animate-pulse' : 
          status === 'hand-raised' ? 'bg-slate-900 border-slate-800' : 'bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-500/20 active:scale-90'
        }`}>
        {status === 'on-air' ? <Radio size={60} className="text-white mb-2" /> : <Mic size={60} className="text-white mb-2" />}
        <span className="text-white font-black uppercase text-sm tracking-widest">
          {status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'Ожидайте' : 'В ЭФИРЕ'}
        </span>
      </button>
    </div>
  );
};

export default ParticipantView;