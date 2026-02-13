import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

// Исправляем иконки Leaflet
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Указываем TS, что peer может быть любым объектом извне
interface AdminViewProps {
  socket: any;
  peer: any; 
}

const AdminView: React.FC<AdminViewProps> = ({ socket, peer }) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mapCenter: [number, number] = [55.75, 37.61];

  const GeomanControl = () => {
    const map = useMap();
    useEffect(() => {
      if (!map) return;
      
      // Инициализируем Geoman только если он доступен
      // @ts-ignore
      if (map.pm) {
        // @ts-ignore
        map.pm.addControls({ 
          position: 'topleft', 
          drawCircle: true, 
          drawMarker: false,
          drawPolyline: false,
          drawRectangle: false,
          drawPolygon: false,
          editMode: true,
          dragMode: true,
          removalMode: true
        });

        map.on('pm:create', (e: any) => {
          const { latlng } = e.layer;
          const radius = e.layer.getRadius();
          console.log("Зона создана:", latlng, radius);
          socket.emit('set-zone', { center: latlng, radius: radius });
        });
      }
    }, [map]);
    return null;
  };

  useEffect(() => {
    if (!socket || !peer) return;

    socket.on('new-hand-raised', (data: any) => {
      setParticipants(prev => {
        if (prev.find(p => p.id === data.id)) return prev;
        return [...prev, data];
      });
    });

    // Слушаем входящие звонки от участников
    peer.on('call', (call: any) => {
      console.log("Получен аудио-поток от участника");
      call.answer(); 
      call.on('stream', (remoteStream: MediaStream) => {
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
          audioRef.current.play().catch(() => console.log("Нужно взаимодействие с картой для звука"));
        }
      });
    });

    return () => { 
      socket.off('new-hand-raised'); 
      peer.off('call');
    };
  }, [peer, socket]);

  const MapProps: any = {
    center: mapCenter,
    zoom: 15,
    scrollWheelZoom: true,
    style: { height: '100%', width: '100%' }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-900">
      {/* Карта занимет верхнюю половину */}
      <div className="h-1/2 w-full border-b border-white/5 relative z-10">
        <MapContainer {...MapProps}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <GeomanControl />
        </MapContainer>
      </div>
      
      {/* Очередь занимает нижнюю половину */}
      <div className="p-4 overflow-y-auto flex-1 bg-slate-900 text-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold tracking-tight">Очередь спикеров</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Кто поднял руку в зоне</p>
          </div>
          <button 
            onClick={() => audioRef.current?.play()} 
            className="text-[10px] bg-slate-800 hover:bg-slate-700 border border-white/10 px-3 py-1.5 rounded-md transition-all active:scale-95"
          >
            🔊 Проверить динамик
          </button>
        </div>

        <audio ref={audioRef} autoPlay className="hidden" />

        <div className="space-y-3">
          {participants.map(p => (
            <div key={p.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex flex-col">
                <span className="font-semibold text-slate-200">{p.name}</span>
                <span className="text-[10px] text-green-500 font-mono">ID: {p.peerId.slice(-6)}</span>
              </div>
              <button 
                onClick={() => socket.emit('give-mic', { targetPeerId: p.peerId, adminPeerId: peer.id })}
                className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-lg text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:transform active:scale-95"
              >
                Включить микрофон
              </button>
            </div>
          ))}
          
          {participants.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-600">
              <div className="text-4xl mb-2">✋</div>
              <p className="text-sm">Пока никто не просит слова</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminView;