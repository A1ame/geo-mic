import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, MicOff, MapPin, Clock, LogOut, ShieldCheck, User } from 'lucide-react';

const ParticipantView = ({ socket, peer, userName, onExit }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>('idle');
  const [availableAdmins, setAvailableAdmins] = useState<any[]>([]);
  const [isApproved, setIsApproved] = useState(false);
  const [activeAdminData, setActiveAdminData] = useState<{name: string, peerId: string} | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Слушаем список событий
    socket.on('available-events', (admins: any[]) => {
      setAvailableAdmins(admins);
    });

    socket.on('join-approved', (data: any) => {
      setActiveAdminData({ name: data.adminName, peerId: data.adminPeerId });
      setIsApproved(true);
      socket.emit('join', { role: 'user', name: userName, peerId: peer.id });
    });

    socket.on('mic-granted', async ({ adminPeerId, targetPeerId }: any) => {
      if (peer.id === targetPeerId) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          stream.getAudioTracks()[0].enabled = !isMuted;
          peer.call(adminPeerId, stream);
          setStatus('on-air');
        } catch (err) {
          console.error("Ошибка микрофона:", err);
        }
      }
    });

    socket.on('mic-revoked', () => {
      setStatus('idle');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    });

    return () => { 
      socket.off('available-events'); 
      socket.off('join-approved'); 
      socket.off('mic-granted');
      socket.off('mic-revoked');
    };
  }, [socket, peer, userName, isMuted]);

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    if (streamRef.current) {
      streamRef.current.getAudioTracks()[0].enabled = !newMute;
    }
  };

  // ЭКРАН 1: ПОИСК СОБЫТИЯ
  if (!isApproved) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-10">
        <div className="mb-10 text-center">
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Поиск трансляций</h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Выберите событие для входа</p>
        </div>

        <div className="w-full max-w-md space-y-4">
          {availableAdmins.length > 0 ? availableAdmins.map(admin => (
            <button 
              key={admin.socketId} 
              onClick={() => socket.emit('request-join', { name: userName, adminSocketId: admin.socketId })}
              className="w-full p-6 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-between hover:bg-indigo-600/20 hover:border-indigo-500/50 transition-all active:scale-95 group"
            >
              <div className="text-left">
                <p className="text-white font-bold text-lg leading-tight">{admin.name}</p>
                <div className="flex items-center gap-2 mt-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-indigo-400 text-[9px] font-black uppercase tracking-widest">В эфире</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                <MapPin size={20} className="text-white"/>
              </div>
            </button>
          )) : (
            <div className="text-center py-20 opacity-40">
              <Clock size={40} className="mx-auto mb-4 animate-spin-slow text-indigo-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Ожидание запуска событий...</p>
            </div>
          )}
        </div>
        
        <button onClick={onExit} className="mt-12 text-slate-700 hover:text-slate-400 font-black uppercase text-[10px] tracking-widest transition-colors flex items-center gap-2">
            <LogOut size={14}/> Назад
        </button>
      </div>
    );
  }

  // ЭКРАН 2: ПУЛЬТ УПРАВЛЕНИЯ ВНУТРИ СОБЫТИЯ
  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-between p-8">
      {/* Шапка участника */}
      <div className="w-full flex items-center justify-between bg-white/5 p-4 rounded-[2rem] border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <ShieldCheck size={20}/>
            </div>
            <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Событие от</p>
                <p className="text-white font-bold text-sm leading-none">{activeAdminData?.name}</p>
            </div>
        </div>
        <button onClick={onExit} className="p-3 bg-white/5 hover:bg-red-500/20 hover:text-red-500 rounded-xl transition-all">
            <LogOut size={18}/>
        </button>
      </div>

      {/* Кнопка микрофона */}
      <div className="flex flex-col items-center">
        <button 
          onClick={() => { if (status === 'idle') { setStatus('hand-raised'); socket.emit('raise-hand'); } }}
          className={`w-72 h-72 rounded-full border-[12px] transition-all duration-500 flex flex-col items-center justify-center relative ${
            status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_80px_rgba(239,68,68,0.4)]' : 
            status === 'hand-raised' ? 'bg-slate-900 border-slate-800' : 'bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-500/20 active:scale-90'
          }`}
        >
          {status === 'on-air' ? <Radio size={64} className="text-white mb-2 animate-pulse" /> : <Mic size={64} className="text-white mb-2" />}
          <span className="text-white font-black uppercase text-sm tracking-widest">
            {status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'Ждем админа' : 'В ЭФИРЕ'}
          </span>
          
          {/* Анимация волн в эфире */}
          {status === 'on-air' && (
            <div className="absolute inset-0 rounded-full animate-ping border border-red-500 opacity-20"></div>
          )}
        </button>

        {/* Кнопка Mute (только в эфире) */}
        {status === 'on-air' && (
          <button 
            onClick={toggleMute} 
            className={`mt-10 px-10 py-5 rounded-3xl font-black uppercase text-xs flex items-center gap-3 border transition-all ${
              isMuted ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
            }`}
          >
            {isMuted ? <MicOff size={20}/> : <Mic size={20}/>}
            {isMuted ? 'Микрофон выключен' : 'Выключить звук'}
          </button>
        )}
      </div>

      {/* Футер */}
      <div className="text-center pb-4">
          <div className="flex items-center gap-2 text-slate-600">
             <User size={12}/>
             <span className="text-[10px] font-black uppercase tracking-[0.2em]">{userName} (Участник)</span>
          </div>
      </div>
    </div>
  );
};

export default ParticipantView;