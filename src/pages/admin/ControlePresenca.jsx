import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { todayISO } from '@/lib/donbaron';
import { ShieldCheck, RefreshCw, KeyRound, Clock, Users, UserCheck, UserX, Hourglass, Lock } from 'lucide-react';

const maskToken = (t) => (t ? '**' + String(t).slice(-2) : '—');

export default function ControlePresenca() {
  const [cycle, setCycle] = useState(null);
  const [motoboys, setMotoboys] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    const today = todayISO();
    const [allMotoboys, todayCheckIns] = await Promise.all([
      base44.entities.Motoboy.list(),
      base44.entities.CheckIn.filter({ data: today, status: 'sucesso' }),
    ]);
    const activeCycles = await base44.entities.CicloOperacional.filter({ data: today, status: 'ativo' });
    const currentCycle = activeCycles[0] || null;
    let todayTokens = [];
    if (currentCycle) {
      todayTokens = await base44.entities.Token.filter({ ciclo_id: currentCycle.id });
    }
    setMotoboys(allMotoboys);
    setCheckIns(todayCheckIns);
    setCycle(currentCycle);
    setTokens(todayTokens);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const unsub = base44.entities.CheckIn.subscribe(() => load());
    const unsubToken = base44.entities.Token.subscribe(() => load());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => { unsub(); unsubToken(); clearInterval(timer); };
  }, [load]);

  const handleGerarPin = async () => {
    setGenerating(true);
    try {
      await base44.functions.invoke('gerarPinDiario', {});
      await load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const ativos = motoboys.filter((m) => m.status === 'ativo');
  const inativos = motoboys.filter((m) => m.status === 'inativo');
  const tokenByMotoboy = new Map(tokens.map((t) => [t.motoboy_id, t]));
  const checkInByMotoboy = new Map(checkIns.map((c) => [c.motoboy_id, c]));

  const presentes = ativos.filter((m) => tokenByMotoboy.get(m.id)?.consumido);
  const aguardando = ativos.filter((m) => {
    const tk = tokenByMotoboy.get(m.id);
    return tk && !tk.consumido;
  });
  const semToken = ativos.filter((m) => !tokenByMotoboy.has(m.id));

  // Countdown to midnight
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msToMidnight = midnight - now;
  const hrsToMidnight = Math.floor(msToMidnight / 3600000);
  const minsToMidnight = Math.floor((msToMidnight % 3600000) / 60000);
  const secsToMidnight = Math.floor((msToMidnight % 60000) / 1000);
  const expiraEm = `${String(hrsToMidnight).padStart(2, '0')}:${String(minsToMidnight).padStart(2, '0')}:${String(secsToMidnight).padStart(2, '0')}`;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-accent" />
            Controle de Presença
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Button onClick={handleGerarPin} disabled={generating} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Gerando...' : 'Gerar Novo PIN'}
        </Button>
      </div>

      {/* PIN Card */}
      <Card className="p-6 border-border/60 shadow-sm">
        {cycle ? (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
                <KeyRound className="w-8 h-8 text-accent" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">PIN Diário</p>
                <p className="text-4xl font-heading font-extrabold tracking-[0.3em] text-foreground">{cycle.pin}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-500">Ativo</Badge>
                  <span className="text-xs text-muted-foreground">Gerado por {cycle.criado_por || '—'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
              <Clock className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Expira em</p>
                <p className="text-xl font-bold text-amber-700 font-mono">{expiraEm}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-8 gap-3">
            <Lock className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum PIN diário ativo. Clique em "Gerar Novo PIN" para iniciar o ciclo operacional.</p>
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-border/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><UserCheck className="w-5 h-5 text-emerald-600" /></div>
          <div><p className="text-2xl font-bold">{presentes.length}</p><p className="text-xs text-muted-foreground">Presentes</p></div>
        </Card>
        <Card className="p-4 border-border/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><Hourglass className="w-5 h-5 text-amber-600" /></div>
          <div><p className="text-2xl font-bold">{aguardando.length}</p><p className="text-xs text-muted-foreground">Aguardando</p></div>
        </Card>
        <Card className="p-4 border-border/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center"><UserX className="w-5 h-5 text-red-600" /></div>
          <div><p className="text-2xl font-bold">{semToken.length}</p><p className="text-xs text-muted-foreground">Sem token</p></div>
        </Card>
        <Card className="p-4 border-border/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center"><Users className="w-5 h-5 text-slate-600" /></div>
          <div><p className="text-2xl font-bold">{ativos.length}</p><p className="text-xs text-muted-foreground">Ativos</p></div>
        </Card>
      </div>

      {/* Motoboy List */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border/60">
          <h3 className="font-heading font-bold text-foreground">Lista de Motoboys</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Tokens exibidos parcialmente por segurança</p>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-5 py-3">Motoboy</th>
                <th className="text-left font-medium px-5 py-3">Status</th>
                <th className="text-left font-medium px-5 py-3">Token</th>
                <th className="text-left font-medium px-5 py-3">Consumido</th>
                <th className="text-left font-medium px-5 py-3">Check-in</th>
              </tr>
            </thead>
            <tbody>
              {ativos.map((m) => {
                const tk = tokenByMotoboy.get(m.id);
                const ci = checkInByMotoboy.get(m.id);
                return (
                  <tr key={m.id} className="border-t border-border/40 hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold uppercase">{m.nome[0]}</div>
                        <span className="font-medium">{m.nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {ci ? (
                        <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">Trabalhando</Badge>
                      ) : tk ? (
                        <Badge variant="outline" className="border-amber-300 text-amber-700">Aguardando</Badge>
                      ) : (
                        <Badge variant="outline" className="border-red-300 text-red-700">Sem token</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-muted-foreground">{tk ? maskToken(tk.token) : '—'}</td>
                    <td className="px-5 py-3">
                      {tk?.consumido ? (
                        <span className="text-emerald-600 font-medium">Sim</span>
                      ) : tk ? (
                        <span className="text-muted-foreground">Não</span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {ci ? ci.hora.substring(0, 5) : '—'}
                    </td>
                  </tr>
                );
              })}
              {inativos.length > 0 && (
                <tr className="border-t border-border/40">
                  <td colSpan={5} className="px-5 py-2 text-xs text-muted-foreground/50 uppercase tracking-wide">
                    {inativos.length} motoboy(s) inativo(s) não listado(s)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}