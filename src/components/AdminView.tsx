import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import Peer from 'peerjs';
import L from 'leaflet'; // Импортируем сам Leaflet для типов
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

// Исправляем иконки Leaflet (они часто пропадают в React)
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const AdminView = ({ socket, peer }: { socket: any, peer: Peer }) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mapCenter: [number, number] = [55.75, 37.61];

  const GeomanControl = () => {
    const map = useMap();
    useEffect(() => {
      // @ts-ignore
      if (map.pm && !map.pm.enabled()) {
        map.pm.addControls({ position: 'topleft', drawCircle: true, drawMarker: false });
        map.on('pm:create', (e: any) => {
          const { latlng } = e.layer;
          const radius = e.layer.getRadius();
          socket.emit('set-zone', { center: latlng, radius: radius });
        });
      }
    }, [map]);
    return null;
  };

  useEffect(() => {
    socket.on('new-hand-raised', (data: any) => {
      setParticipants(prev => {
        if (prev.find(p => p.id === data.id)) return prev;
        return [...prev, data];
      });
    });

    peer.on('call', (call) => {
      call.answer(); 
      call.on('stream', (remoteStream) => {
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
          audioRef.current.play().catch(() => console.log("Нужен клик для звука"));
        }
      });
    });

    return () => { socket.off('new-hand-raised'); };
  }, [peer, socket]);

  // Используем небольшую хитрость для MapContainer, чтобы TS не ругался на center
  const MapProps: any = {
    center: mapCenter,
    zoom: 15,
    style: { height: '100%', width: '100%' }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-900">
      <div className="h-1/2 w-full border-b border-slate-700">
        <MapContainer {...MapProps}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <GeomanControl />
        </MapContainer>
      </div>
      
      <div className="p-4 overflow-y-auto flex-1 bg-slate-800 text-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Очередь (кто в зоне)</h2>
          <button 
            onClick={() => audioRef.current?.play()} 
            className="text-[10px] bg-blue-500 px-2 py-1 rounded shadow-lg active:scale-95"
          >
            🔊 Тест звука
          </button>
        </div>
        <audio ref={audioRef} autoPlay className="hidden" />
        <div className="space-y-2">
          {participants.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg shadow-md border border-slate-600">
              <span className="font-medium">{p.name} ✋</span>
              <button 
                onClick={() => socket.emit('give-mic', { targetPeerId: p.peerId, adminPeerId: peer.id })}
                className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-full text-sm font-bold transition-colors"
              >
                Дать микрофон
              </button>
            </div>
          ))}
          {participants.length === 0 && (
            <div className="text-center py-10 text-slate-500">
              Очередь пуста. Ждем поднятых рук...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminView;