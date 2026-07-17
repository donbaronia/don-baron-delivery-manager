import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { todayISO } from '@/lib/donbaron';

export default function LivePanel({ motoboys }) {
  const [checkIns, setCheckIns] = useState([]);

  useEffect(() => {
    const load = async () => {
      const today = todayISO();
      const list = await base44.entities.CheckIn.filter({ data: today, status: 'sucesso' });
      setCheckIns(list);
    };
    load();
    const unsub = base44.entities.CheckIn.subscribe(() => load());
    return () => unsub();
  }, [motoboys]);

  const checkedInIds = new Set(checkIns.map((c) => c.motoboy_id));

  const groups = {
    working: motoboys.filter((m) => checkedInIds.has(m.id)),
    waiting: motoboys.filter((m) => m.status === 'ativo' && !checkedInIds.has(m.id)),
    inactive: motoboys.filter((m) => m.status === 'inativo'),
  };

  const config = [
    { key: 'working', label: 'Trabalhando', dot: 'bg-emerald-500', ring: 'border-emerald-200', items: groups.working },
    { key: 'waiting', label: 'Aguardando check-in', dot: 'bg-amber-400', ring: 'border-amber-200', items: groups.waiting },
    { key: 'inactive', label: 'Inativo', dot: 'bg-slate-400', ring: 'border-slate-200', items: groups.inactive },
  ];

  const lastCheckIn = checkIns.sort((a, b) => b.hora.localeCompare(a.hora))[0];

  return (
    <Card className="p-5 border-border/60 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-heading font-bold text-foreground">Painel ao Vivo</h3>
          <p className="text-xs text-muted-foreground">
            Atualização automática {lastCheckIn && `• Último check-in: ${lastCheckIn.motoboy_nome} às ${lastCheckIn.hora}`}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Tempo real
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {config.map((g) => (
          <div key={g.key} className={`rounded-xl border ${g.ring} bg-card p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2.5 h-2.5 rounded-full ${g.dot}`} />
              <span className="text-sm font-semibold text-foreground">{g.label}</span>
              <span className="text-xs text-muted-foreground ml-auto">{g.items.length}</span>
            </div>
            <div className="space-y-1.5 min-h-[40px]">
              {g.items.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic">Nenhum</p>
              ) : (
                g.items.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground uppercase">
                      {m.nome[0]}
                    </div>
                    <span className="text-foreground truncate">{m.nome}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}