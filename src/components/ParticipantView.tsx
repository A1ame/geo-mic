import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, MicOff, MapPin, Clock, LogOut, ShieldCheck, RefreshCw } from 'lucide-react';

const ParticipantView = ({ socket, peer, userName, onExit }: any) => {
  const [status, setStatus] = useState<'idle' | 'hand-raised' | 'on-air'>('idle');
  const [availableAdmins, setAvailableAdmins] = useState<any[]>([]);
  const [isApproved, setIsApproved] = useState(false);
  const [activeAdminData, setActiveAdminData] = useState<{name: string, peerId: string} | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // 1. Принудительно запрашиваем список при входе
    socket.emit('get-available-events');

    // 2. Ставим интервал обновления, чтобы не перезагружать страницу вручную
    const pollInterval = setInterval(() => {
      if (!isApproved) {
        socket.emit('get-available-events');
      }
    }, 2000);

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
      clearInterval(pollInterval);
      socket.off('available-events');
      socket.off('join-approved');
      socket.off('mic-granted');
      socket.off('mic-revoked');
    };
  }, [socket, peer, userName, isApproved, isMuted]);

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    if (streamRef.current) {
      streamRef.current.getAudioTracks()[0].enabled = !newMute;
    }
  };

  // ЭКРАН ПОИСКА
  if (!isApproved) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-10">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Geo-Mic</h2>
          <div className="flex items-center justify-center gap-2 text-indigo-400 mt-2">
            <RefreshCw size={12} className="animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest">Авто-поиск трансляций...</span>
          </div>
        </div>

        <div className="w-full max-w-md space-y-4">
          {availableAdmins.length > 0 ? (
            availableAdmins.map((admin) => (
              <button
                key={admin.socketId}
                onClick={() => socket.emit('request-join', { name: userName, adminSocketId: admin.socketId })}
                className="w-full p-6 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-between hover:bg-indigo-600/20 hover:border-indigo-500 transition-all active:scale-95 group"
              >
                <div className="text-left">
                  <p className="text-white font-bold text-lg leading-tight">{admin.name}</p>
                  <p className="text-indigo-400 text-[10px] font-black uppercase mt-1">Нажмите для входа</p>
                </div>
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <MapPin size={20} className="text-white" />
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-20 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
              <Clock size={40} className="mx-auto mb-4 text-slate-700 animate-pulse" />
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">События не найдены</p>
            </div>
          )}
        </div>

        <button onClick={onExit} className="mt-12 flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">
          <LogOut size={14} /> Назад
        </button>
      </div>
    );
  }

  // ЭКРАН ВНУТРИ СОБЫТИЯ
  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-between p-8">
      {/* Шапка */}
      <div className="w-full flex items-center justify-between bg-white/5 p-4 rounded-[2rem] border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Вы на событии</p>
            <p className="text-white font-bold text-sm leading-none">{activeAdminData?.name}</p>
          </div>
        </div>
        <button onClick={onExit} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all">
          <LogOut size={18} />
        </button>
      </div>

      {/* Основная кнопка */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => { if (status === 'idle') { setStatus('hand-raised'); socket.emit('raise-hand'); } }}
          className={`w-72 h-72 rounded-full border-[12px] transition-all duration-500 flex flex-col items-center justify-center relative ${
            status === 'on-air' ? 'bg-red-600 border-red-400 shadow-[0_0_80px_rgba(239,68,68,0.4)] animate-pulse' :
            status === 'hand-raised' ? 'bg-slate-900 border-slate-800' : 'bg-indigo-600 border-indigo-400 shadow-2xl active:scale-90'
          }`}
        >
          {status === 'on-air' ? <Radio size={64} className="text-white mb-2" /> : <Mic size={64} className="text-white mb-2" />}
          <span className="text-white font-black uppercase text-sm tracking-widest">
            {status === 'idle' ? 'Сказать' : status === 'hand-raised' ? 'Ждем админа' : 'В ЭФИРЕ'}
          </span>
        </button>

        {/* Управление звуком */}
        {status === 'on-air' && (
          <button
            onClick={toggleMute}
            className={`mt-10 px-10 py-5 rounded-3xl font-black uppercase text-xs flex items-center gap-3 border transition-all ${
              isMuted ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
            }`}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            {isMuted ? 'Звук выключен' : 'Выключить микрофон'}
          </button>
        )}
      </div>

      {/* Футер */}
      <div className="pb-4 text-center">
        <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">Ваш профиль: {userName}</p>
      </div>
    </div>
  );
};

export default ParticipantView;