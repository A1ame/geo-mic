import React, { useState } from 'react';

interface RoleSelectionProps {
  onSelect: (role: 'admin' | 'user', name: string) => void;
}

const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelect }) => {
  const [name, setName] = useState('');

  const isInvalid = name.trim().length < 2;

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 p-6 selection:bg-indigo-500/30">
      <div className="w-full max-w-sm">
        {/* Логотип и заголовок */}
        <div className="flex flex-col items-center mb-12">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-blue-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-6 rotate-3">
            <span className="text-white text-3xl font-black">G</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-2 tracking-tighter">GEO-MIC</h1>
          <p className="text-slate-500 text-sm font-medium tracking-wide uppercase opacity-60">
            Smart Audio Zones
          </p>
        </div>
        
        {/* Поле ввода */}
        <div className="relative group mb-8">
          <input
            type="text"
            placeholder="Ваше имя..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-5 bg-slate-900/50 border border-white/5 rounded-3xl text-white placeholder:text-slate-600 focus:ring-2 ring-indigo-500/50 outline-none transition-all duration-300 backdrop-blur-sm group-hover:border-white/10"
          />
          {name.length > 0 && (
            <div className="absolute right-5 top-5 text-indigo-500 animate-in zoom-in">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        
        {/* Кнопки выбора роли */}
        <div className="space-y-4">
          <button
            onClick={() => !isInvalid && onSelect('admin', name.trim())}
            disabled={isInvalid}
            className={`w-full py-5 rounded-3xl font-black text-sm uppercase tracking-widest transition-all duration-300 ${
              isInvalid 
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' 
                : 'bg-white text-black hover:bg-indigo-50 hover:scale-[1.02] active:scale-95 shadow-xl shadow-white/5'
            }`}
          >
            Создать событие
          </button>
          
          <button
            onClick={() => !isInvalid && onSelect('user', name.trim())}
            disabled={isInvalid}
            className={`w-full py-5 rounded-3xl font-black text-sm uppercase tracking-widest transition-all duration-300 border ${
              isInvalid 
                ? 'bg-transparent border-slate-800 text-slate-700 cursor-not-allowed' 
                : 'bg-slate-900 text-white border-white/10 hover:bg-slate-800 hover:scale-[1.02] active:scale-95'
            }`}
          >
            Присоединиться
          </button>
        </div>

        <p className="mt-10 text-center text-[10px] text-slate-600 uppercase tracking-[0.3em] font-bold">
          v2.0 Beta • Geolocation Ready
        </p>
      </div>
    </div>
  );
};

export default RoleSelection;