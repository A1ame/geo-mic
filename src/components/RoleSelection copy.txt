import React, { useState } from 'react';

interface RoleSelectionProps {
  onSelect: (role: 'admin' | 'user', name: string) => void;
}

const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelect }) => {
  const [name, setName] = useState('');
  const isInvalid = name.trim().length < 2;

  const handleSelect = (role: 'admin' | 'user') => {
    if (!isInvalid) onSelect(role, name.trim());
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 text-center">
      <div className="w-full max-w-sm flex flex-col items-center">
        
        {/* Логотип */}
        <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-blue-400 rounded-3xl flex items-center justify-center shadow-2xl mb-8 rotate-3">
          <span className="text-white text-4xl font-black">G</span>
        </div>

        <h1 className="text-5xl font-black text-white tracking-tighter mb-2 uppercase italic">Geo-Mic</h1>
        <p className="text-slate-500 text-xs font-bold tracking-[0.3em] uppercase mb-12 opacity-60">Smart Audio Zones</p>
        
        {/* Поле ввода */}
        <input
          type="text"
          placeholder="Ваше имя..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-5 bg-slate-900 border border-white/10 rounded-2xl text-white text-center mb-6 outline-none focus:ring-2 ring-indigo-500 transition-all"
        />
        
        {/* Кнопки */}
        <div className="w-full space-y-4">
          <button
            onClick={() => handleSelect('admin')}
            disabled={isInvalid}
            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all ${
              isInvalid ? 'bg-slate-800 text-slate-600' : 'bg-white text-black hover:scale-[1.02]'
            }`}
          >
            Создать событие
          </button>
          
          <button
            onClick={() => handleSelect('user')}
            disabled={isInvalid}
            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all border ${
              isInvalid ? 'border-slate-800 text-slate-800' : 'border-white/20 text-white hover:bg-white/5'
            }`}
          >
            Войти как гость
          </button>
        </div>

        <p className="mt-12 text-[10px] text-slate-600 font-bold uppercase tracking-widest">v2.0 Beta • Ready</p>
      </div>
    </div>
  );
};

export default RoleSelection;