import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, ShieldAlert, MicOff, LogOut, Users, Clock } from 'lucide-react';

const ParticipantView = ({ socket, peer, isInside, userName, adminData, onExit }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>('idle');
  const [isApproved, setIsApproved] = useState(() => localStorage.getItem('approved') === 'true');
  const [participants, setParticipants] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!socket || !peer) return;

    const startCall = async (adminPeerId: string) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            
            // ФИКС БАГА С MUTE: применяем текущее состояние перед звонком
            stream.getAudioTracks()[0].enabled = !isMuted;
            
            peer.call(adminPeerId, stream);
            setStatus('on-air');
        } catch (err) { setStatus('idle'); }
    };

    socket.on('join-approved', () => {
        setIsApproved(true);
        localStorage.setItem('approved', 'true');
        socket.emit('join', { role: 'user', name: userName, peerId: peer.id });
    });

    socket.on('mic-granted', ({ targetPeerId, adminPeerId }: any) => {
      if (peer.id === targetPeerId) startCall(adminPeerId);
    });

    socket.on('mic-revoked', ({ targetPeerId }: any) => {
      if (peer.id === targetPeerId) stopStreaming();
    });

    socket.on('admin-updated', (newAdmin: any) => {
        if (status === 'on-air' && newAdmin.peerId && streamRef.current) {
            // ФИКС: При переподключении к админу сохраняем состояние Mute
            streamRef.current.getAudioTracks()[0].enabled = !isMuted;
            peer.call(newAdmin.peerId, streamRef.current);
        }
    });

    socket.on('participants-list', (list: any[]) => {
      setParticipants(list.filter(p => p.role === 'user' && p.name !== userName));
      const me = list.find(p => p.name === userName);
      if (me && !me.isOnAir && status === 'on-air') stopStreaming();
    });

    return () => {
      socket.off('mic-granted'); socket.off('mic-revoked');
      socket.off('admin-updated'); socket.off('participants-list');
      socket.off('join-approved');
    };
  }, [socket, peer, status, isMuted, userName]);

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
    } else {
        setIsMuted(!isMuted); // Меняем состояние, даже если эфира нет (для будущего звонка)
    }
  };

  if (!isInside) return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <ShieldAlert size={64} className="text-red-600 mb-6 animate-pulse" />
      <h2 className="text-2xl font-black uppercase italic text-white">Вне зоны</h2>
      <button onClick={onExit} className="mt-8 px-10 py-3 bg-white/5 border border-white/10 rounded-2xl font-black uppercase text-[10px] text-white">Выйти</button>
    </div>
  );

  if (!isApproved) return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-indigo-600/20 rounded-full flex items-center justify-center mb-8 border border-indigo-500/30">
            <Clock size={40} className="text-indigo-500 animate-spin-slow" />
        </div>
        <h2 className="text-2xl font-black uppercase text-white italic mb-2">Запрос отправлен</h2>
        <p className="text-slate-500 text-sm max-w-[200px] mb-8">Администратор <b>{adminData.name}</b> должен подтвердить ваш вход</p>
        <button onClick={() => socket.emit('request-join', { name: userName, coords: null })} className="px-8 py-4 bg-indigo-600 rounded-2xl font-black uppercase text-xs text-white">Повторить запрос</button>
        <button onClick={onExit} className="mt-4 text-slate-600 uppercase text-[10px] font-black">Отмена</button>
    </div>
  )

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-between py-12 px-6">
      <div className="text-center">
        <p className="text-indigo-500 font-black text-[10px] uppercase tracking-[0.3em] mb-2">Событие от</p>
        <h2 className="text-3xl font-black text-white italic uppercase">{adminData.name}</h2>
      </div>

      <div className="flex flex-col items-center">
        <button
            onClick={() => { if (status === 'idle') { setStatus('hand-raised'); socket.emit('raise-hand'); } }}
            className={`w-60 h-60 rounded-full border-8 transition-all flex flex-col items-center justify-center ${
            status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_60px_#ef4444]' : 
            status === 'hand-raised' ? 'bg-slate-900 border-indigo-900 text-slate-500' : 
            'bg-indigo-600 border-indigo-400 shadow-2xl active:scale-95'
            }`}
        >
            {status === 'on-air' ? <Radio size={48} className="text-white mb-2"/> : <Mic size={48} className="text-white mb-2"/>}
            <span className="text-white font-black uppercase tracking-widest text-xs">
                {status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'Ждите...' : 'В ЭФИРЕ'}
            </span>
        </button>

        <button onClick={toggleMute} className={`mt-8 flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase text-xs border transition-all ${isMuted ? 'bg-red-500 border-red-400 text-white' : 'bg-white/5 border-white/10 text-white'}`}>
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />} {isMuted ? 'Микрофон выкл.' : 'Выключить звук'}
        </button>
      </div>

      <div className="w-full max-w-xs text-center">
        <div className="flex flex-wrap justify-center gap-2 mb-6">
            {participants.map(p => <div key={p.socketId} className="px-3 py-1 bg-white/5 rounded-full text-[9px] font-bold text-slate-400 border border-white/5">{p.name}</div>)}
        </div>
        <button onClick={onExit} className="text-slate-700 font-black uppercase text-[9px]">Покинуть событие</button>
      </div>
    </div>
  );
};

export default ParticipantView;