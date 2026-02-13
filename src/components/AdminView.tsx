import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, useMapEvents, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Radio, Mic, Users } from 'lucide-react';

// Фикс иконок
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Добавляем socket и peer в пропсы
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

    // Слушаем поднятые руки
    socket.on('new-hand-raised', (data: any) => {
      setParticipants(prev => {
        if (prev.find(p => p.id === data.id)) return prev;
        return [...prev, data];
      });
    });

    // Слушаем входящий звук
    peer.on('call', (call: any) => {
      call.answer();
      call.on('stream', (remoteStream: MediaStream) => {
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
          audioRef.current.play().catch(() => console.log("Нажми на страницу для звука"));
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
      // ОТПРАВЛЯЕМ ЗОНУ НА СЕРВЕР
      socket.emit('set-zone', { center: coords, radius: radius });
      setIsEventStarted(true);
    }
  };

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (!isEventStarted) setCoords([e.latlng.lat, e.latlng.lng]);
      },
    });
    return null;
  };

  if (!coords) return (
    <div className="h-screen bg-slate-950 flex items-center justify-center text-white font-black animate-pulse">
      ОПРЕДЕЛЕНИЕ ГЕОПОЗИЦИИ...
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white">
      <audio ref={audioRef} autoPlay className="hidden" />
      
      {/* Header */}
      <div className="p-6 bg-slate-900/50 border-b border-white/5 flex justify-between items-center z-50">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight italic">Control Panel</h2>
          <p className="text-slate-500 text-[10px] tracking-[0.3em] uppercase">{adminName} • {isEventStarted ? 'Live' : 'Setup'}</p>
        </div>
        <div className={`w-3 h-3 rounded-full shadow-[0_0_15px] ${isEventStarted ? 'bg-red-500 shadow-red-500 animate-pulse' : 'bg-slate-700'}`} />
      </div>

      {/* Map */}
      <div className="relative flex-grow h-1/2">
        <MapContainer center={coords} zoom={17} className="h-full w-full grayscale-[0.6] contrast-[1.2]">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapEvents />
          <Marker position={coords} />
          <Circle 
            center={coords} 
            radius={radius} 
            pathOptions={{ color: isEventStarted ? '#6366f1' : '#94a3b8', weight: 2, fillOpacity: 0.1 }} 
          />
        </MapContainer>

        {!isEventStarted && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-[1000]">
            <div className="bg-slate-900/95 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
              <div className="flex justify-between items-center mb-4 px-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Distance</span>
                <span className="text-indigo-400 font-black">{radius}m</span>
              </div>
              <input 
                type="range" min="10" max="500" step="10" 
                value={radius} 
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 mb-6"
              />
              <button 
                onClick={startEvent}
                className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:invert transition-all flex items-center justify-center gap-3 shadow-xl"
              >
                <Mic size={18} /> Create Event
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Participants List */}
      <div className="h-1/3 bg-slate-950 p-6 overflow-y-auto border-t border-white/5">
        <div className="flex items-center justify-between mb-6">
           <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Queue</h3>
           <div className="flex gap-4">
              <div className="flex items-center gap-2 text-xs font-bold"><Users size={14}/> {participants.length}</div>
              <div className="flex items-center gap-2 text-xs font-bold text-red-500"><Radio size={14}/> LIVE</div>
           </div>
        </div>

        <div className="space-y-3">
          {participants.map(p => (
            <div key={p.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
              <span className="font-bold tracking-tight">{p.name}</span>
              <button 
                onClick={() => socket.emit('give-mic', { targetPeerId: p.peerId, adminPeerId: peer.id })}
                className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-indigo-500/20"
              >
                Enable Mic
              </button>
            </div>
          ))}
          {participants.length === 0 && isEventStarted && (
            <p className="text-center text-slate-700 text-xs py-10 uppercase tracking-[0.2em]">Waiting for hands...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminView;