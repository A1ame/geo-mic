import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, useMapEvents, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Radio, Mic, Users, Settings2 } from 'lucide-react';

const AdminView = ({ socket, peer, adminName }: { socket: any, peer: any, adminName: string }) => {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(100);
  const [isEventStarted, setIsEventStarted] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.error("Ошибка гео:", err),
      { enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (!socket || !peer) return;
    socket.on('new-hand-raised', (data: any) => {
      setParticipants(prev => prev.find(p => p.id === data.id) ? prev : [...prev, data]);
    });

    peer.on('call', (call: any) => {
      call.answer();
      call.on('stream', (remoteStream: MediaStream) => {
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
          audioRef.current.play().catch(() => console.log("Нужен клик для звука"));
        }
      });
    });

    return () => {
      socket.off('new-hand-raised');
      peer.off('call');
    };
  }, [socket, peer]);

  const startEvent = () => {
    if (coords && socket) {
      socket.emit('set-zone', { center: coords, radius: radius });
      setIsEventStarted(true);
    }
  };

  if (!coords) return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-indigo-400 font-black uppercase tracking-widest text-[10px]">Определение геопозиции...</p>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      <audio ref={audioRef} autoPlay className="hidden" />
      
      {/* Header */}
      <header className="px-8 py-6 bg-slate-900/50 backdrop-blur-xl border-b border-white/5 flex justify-between items-center z-[1001]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center">
            <Mic size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tighter leading-none mb-1">Live Control</h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest italic">{adminName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-slate-950/50 px-4 py-2 rounded-full border border-white/5">
          <span className={`w-2 h-2 rounded-full ${isEventStarted ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">{isEventStarted ? 'On Air' : 'Setup'}</span>
        </div>
      </header>

      {/* Map Section */}
      <div className="relative h-1/2 flex-shrink-0 border-b border-white/5">
        <MapContainer center={coords} zoom={17} className="h-full w-full grayscale-[0.6]">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={coords} />
          <Circle center={coords} radius={radius} pathOptions={{ color: '#6366f1', weight: 2, fillOpacity: 0.1 }} />
        </MapContainer>

        {!isEventStarted && (
          <div className="absolute inset-x-0 bottom-6 flex justify-center z-[1000] px-6">
            <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
              <div className="flex justify-between items-center mb-6 px-2">
                <div className="flex items-center gap-2 text-slate-400 font-black uppercase tracking-widest text-[10px]">
                  <Settings2 size={14} /> Радиус зоны
                </div>
                <span className="text-indigo-400 font-black">{radius}м</span>
              </div>
              <input 
                type="range" min="10" max="500" step="10" value={radius} 
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 mb-8"
              />
              <button 
                onClick={startEvent}
                className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-3"
              >
                Создать событие
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Queue Section */}
      <div className="flex-grow p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Очередь спикеров</h3>
          <div className="flex gap-6 text-slate-400">
            <div className="flex items-center gap-2 text-xs font-bold uppercase"><Users size={14} /> {participants.length}</div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-red-500"><Radio size={14} /> Live</div>
          </div>
        </div>

        <div className="grid gap-3">
          {participants.map(p => (
            <div key={p.id} className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 transition-all">
              <span className="text-lg font-bold tracking-tight">{p.name}</span>
              <button 
                onClick={() => socket.emit('give-mic', { targetPeerId: p.peerId, adminPeerId: peer.id })}
                className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20"
              >
                Дать слово
              </button>
            </div>
          ))}
          {participants.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-[2.5rem]">
               <p className="text-slate-700 text-xs font-black uppercase tracking-widest">Ожидание заявок...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminView;