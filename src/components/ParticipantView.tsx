import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, ShieldAlert, MicOff, Users, Clock, MapPin } from 'lucide-react';

const ParticipantView = ({ socket, peer, isInside, userName, onExit }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>('idle');
  const [availableAdmins, setAvailableAdmins] = useState<any[]>([]);
  const [isApproved, setIsApproved] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    socket.on('available-events', (admins: any[]) => setAvailableAdmins(admins));
    
    socket.on('join-approved', (data: any) => {
      setIsApproved(true);
      socket.emit('join', { role: 'user', name: userName, peerId: peer.id });
    });

    socket.on('mic-granted', async ({ targetPeerId, adminPeerId }: any) => {
      if (peer.id === targetPeerId) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        // ФИКС: Применяем Mute сразу
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
  }, [socket, peer, userName, isMuted]);

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    if (streamRef.current) {
      streamRef.current.getAudioTracks()[0].enabled = !newMute;
    }
  };

  // ЭКРАН ВЫБОРА СОБЫТИЯ
  if (!isApproved) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl mb-8 rotate-3">
          <Radio size={32} className="text-white" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase italic mb-8 tracking-tighter">События рядом</h2>
        <div className="w-full max-w-sm space-y-3">
          {availableAdmins.map(admin => (
            <button 
              key={admin.socketId}
              onClick={() => socket.emit('request-join', { name: userName, adminSocketId: admin.socketId })}
              className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-all"
            >
              <div className="text-left">
                <p className="text-white font-bold text-sm">{admin.name}</p>
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Нажмите, чтобы войти</p>
              </div>
              <MapPin size={16} className="text-indigo-500" />
            </button>
          ))}
          {availableAdmins.length === 0 && (
            <div className="text-center py-10 opacity-30">
              <Clock size={24} className="mx-auto mb-2 animate-spin-slow" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Поиск событий...</p>
            </div>
          )}
        </div>
        <button onClick={onExit} className="mt-12 text-slate-700 text-[10px] font-black uppercase tracking-widest">Выйти</button>
      </div>
    );
  }

  // ЭКРАН ПУЛЬТА
  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <button
        onClick={() => { if (status === 'idle') { setStatus('hand-raised'); socket.emit('raise-hand'); } }}
        className={`w-64 h-64 rounded-full border-8 transition-all flex flex-col items-center justify-center ${
          status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_50px_#ef4444]' : 
          status === 'hand-raised' ? 'bg-slate-900 border-indigo-900' : 'bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-500/20'
        }`}
      >
        <Mic size={48} className="text-white mb-2" />
        <span className="text-white font-black uppercase text-xs">
          {status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'Ждите...' : 'В ЭФИРЕ'}
        </span>
      </button>

      {status === 'on-air' && (
        <button onClick={toggleMute} className={`mt-10 px-8 py-4 rounded-2xl font-black uppercase text-xs flex items-center gap-2 border transition-all ${isMuted ? 'bg-red-500 border-red-400' : 'bg-white/5 border-white/10'}`}>
          {isMuted ? <MicOff size={16}/> : <Mic size={16}/>} {isMuted ? 'Звук выкл' : 'Выключить звук'}
        </button>
      )}
    </div>
  );
};

export default ParticipantView;