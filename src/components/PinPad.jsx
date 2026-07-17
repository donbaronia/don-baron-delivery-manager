import { useState } from 'react';
import { Delete } from 'lucide-react';

export default function PinPad({ onComplete, loading, error }) {
  const [pin, setPin] = useState('');

  const handleDigit = (d) => {
    if (pin.length < 5 && !loading) {
      const newPin = pin + d;
      setPin(newPin);
      if (newPin.length === 5) {
        onComplete(newPin);
        setTimeout(() => setPin(''), 300);
      }
    }
  };

  const handleDelete = () => !loading && setPin(pin.slice(0, -1));

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
              i < pin.length ? 'bg-accent scale-110' : 'bg-muted border border-border'
            }`}
          />
        ))}
      </div>
      {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            onClick={() => handleDigit(String(d))}
            disabled={loading}
            className="w-16 h-16 rounded-2xl bg-secondary hover:bg-accent/15 text-xl font-bold text-foreground transition-all duration-150 active:scale-95 disabled:opacity-40 shadow-sm"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          onClick={() => handleDigit('0')}
          disabled={loading}
          className="w-16 h-16 rounded-2xl bg-secondary hover:bg-accent/15 text-xl font-bold text-foreground transition-all duration-150 active:scale-95 disabled:opacity-40 shadow-sm"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="w-16 h-16 rounded-2xl bg-secondary hover:bg-red-50 flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-40 shadow-sm"
        >
          <Delete className="w-5 h-5 text-foreground" />
        </button>
      </div>
    </div>
  );
}