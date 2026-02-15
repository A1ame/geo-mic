import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Radio, Users, Check, X, LogOut, Mic, Settings2 } from 'lucide-react';

const AdminView = ({ socket, peer, adminName, onExit }: any) => {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [isEventStarted, setIsEventStarted] = useState(() => localStorage.getItem('isStarted') === 'true');
  const [participants, setParticipants] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
        setCoords([pos.coords.latitude, pos.coords.longitude]);
    });

    if (isEventStarted && peer) {
      socket.emit('join', { role: 'admin', name: adminName, peerId: peer.id });
    }

    socket.on('participants-list', (list: any[]) => setParticipants(list.filter(p => p.role === 'user')));
    socket.on('new-request', (reqList: any[]) => setRequests(reqList));

    if (peer) {
      peer.on('call', (call: any) => {
        call.answer();
        call.on('stream', (remoteStream: MediaStream) => {
          if (audioRef.current) {
            audioRef.current.srcObject = remoteStream;
            audioRef.current.play().catch(e => console.error("Audio play failed", e));
          }
        });
      });
    }

    return () => {
      socket.off('participants-list');
      socket.off('new-request');
    };
  }, [socket, peer, isEventStarted]);

  const toggleEvent = () => {
    if (isEventStarted) {
      socket.emit('stop-event');
      localStorage.removeItem('isStarted');
      setIsEventStarted(false);
    } else {
      socket.emit('join', { role: 'admin', name: adminName, peerId: peer.id });
      localStorage.setItem('isStarted', 'true');
      setIsEventStarted(true);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950">
      <audio ref={audioRef} className="hidden" />
      
      {/* Боковая панель */}
      <div className="w-96 bg-slate-900 border-r border-white/10 flex flex-col z-[1000]">
        <div className="p-8 border-b border-white/10">
          <div className="flex items-center gap-3 mb-8">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20"><Radio size={20}/></div>
             <h2 className="text-xl font-black italic uppercase tracking-tighter">Geo-Mic Admin</h2>
          </div>

          <button 
            onClick={toggleEvent} 
            className={`w-full py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-2xl ${
              isEventStarted ? 'bg-red-600 shadow-red-500/20' : 'bg-indigo-600 shadow-indigo-500/20'
            }`}
          >
            {isEventStarted ? 'Остановить трансляцию' : 'Запустить трансляцию'}
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 space-y-8">
          {/* Секция запросов */}
          <div>
            <div className="flex items-center justify-between mb-4 px-2">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Запросы ({requests.length})</p>
            </div>
            <div className="space-y-3">
                {requests.map(req => (
                    <div key={req.peerId} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                        <span className="font-bold text-sm">{req.name}</span>
                        <div className="flex gap-2">
                            <button onClick={() => socket.emit('approve-user', req.socketId)} className="p-2 bg-green-500 rounded-xl"><Check size={16}/></button>
                            <button className="p-2 bg-white/10 rounded-xl"><X size={16}/></button>
                        </div>
                    </div>
                ))}
            </div>
          </div>

          {/* Список участников */}
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4 px-2">В зоне ({participants.length})</p>
            <div className="space-y-3">
              {participants.map(p => (
                <div key={p.peerId} className={`p-5 rounded-[2rem] border transition-all ${p.handRaised ? 'bg-indigo-500/20 border-indigo-500 animate-pulse' : 'bg-white/5 border-white/5'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-sm">{p.name} {p.isOnAir && '🎙️'}</span>
                    <button 
                        onClick={() => socket.emit(p.isOnAir ? 'revoke-mic' : 'give-mic', { targetPeerId: p.peerId, adminPeerId: peer.id, socketId: p.socketId })}
                        className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${p.isOnAir ? 'bg-red-500' : 'bg-indigo-600'}`}
                    >
                        {p.isOnAir ? 'Mute' : (p.handRaised ? 'Принять ✋' : 'Mic')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/5">
            <button onClick={onExit} className="flex items-center gap-3 text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"><LogOut size={16}/> Выйти из системы</button>
        </div>
      </div>

      {/* Карта */}
      <div className="flex-grow relative">
        {coords && (
          <MapContainer center={coords} zoom={15} className="h-full w-full grayscale-[0.2] brightness-[0.8]">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <Circle center={coords} radius={100} pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.1 }} />
            <Marker position={coords}>
               <Tooltip permanent direction="top">Ваша зона</Tooltip>
            </Marker>
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default AdminView;