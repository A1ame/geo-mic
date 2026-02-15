import React, { useState } from 'react';

interface RoleSelectionProps {
  onSelect: (role: 'admin' | 'user', name: string) => void;
}

const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelect }) => {
  const [name, setName] = useState('');
  const isInvalid = name.trim().length < 2;

  const handleSelect = (role: 'admin' | 'user') => {
    if (!isInvalid) {
      onSelect(role, name.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6">
      <div className="w-full max-w-sm space-y-12">
        
        {/* Logo Section */}
        <div className="text-center space-y-6">
          <div className="inline-flex w-20 h-20 bg-gradient-to-tr from-indigo-600 to-blue-400 rounded-[2rem] items-center justify-center shadow-2xl shadow-indigo-500/20 rotate-3 mx-auto">
            <span className="text-white text-4xl font-black">G</span>
          </div>
          <div>
            <h1 className="text-6xl font-black text-white tracking-tighter mb-2">GEO-MIC</h1>
            <p className="text-slate-500 text-xs font-bold tracking-[0.4em] uppercase opacity-60">Smart Audio Zones</p>
          </div>
        </div>
        
        {/* Input */}
        <div className="relative group">
          <input
            type="text"
            placeholder="Введите ваше имя..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-6 bg-slate-900/50 border border-white/5 rounded-[2rem] text-white text-center text-lg placeholder:text-slate-600 focus:ring-2 ring-indigo-500/50 outline-none transition-all duration-300 backdrop-blur-sm"
          />
        </div>
        
        {/* Buttons */}
        <div className="grid gap-4">
          <button
            type="button"
            onClick={() => handleSelect('admin')}
            disabled={isInvalid}
            className={`w-full py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all duration-300 ${
              isInvalid 
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                : 'bg-white text-black hover:scale-[1.02] active:scale-95 shadow-xl shadow-white/5'
            }`}
          >
            Создать событие
          </button>
          
          <button
            type="button"
            onClick={() => handleSelect('user')}
            disabled={isInvalid}
            className={`w-full py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all duration-300 border ${
              isInvalid 
                ? 'bg-transparent border-slate-800 text-slate-700 cursor-not-allowed'
                : 'bg-slate-900 text-white border-white/10 hover:bg-slate-800 hover:scale-[1.02] active:scale-95'
            }`}
          >
            Войти как гость
          </button>
        </div>

        <p className="text-center text-[10px] text-slate-600 uppercase tracking-[0.3em] font-bold opacity-40">
          v2.0 Beta • Geolocation Audio
        </p>
      </div>
    </div>
  );
};

export default RoleSelection;