import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import StatCard from '@/components/StatCard';
import LivePanel from '@/components/LivePanel';
import EmergencyCheckin from '@/components/EmergencyCheckin';
import { formatBRL, getDiaria, todayISO } from '@/lib/donbaron';
import { Users, UserCheck, UserX, Wallet, TrendingUp, Banknote, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function Dashboard() {
  const [motoboys, setMotoboys] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [payments, setPayments] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  const load = async () => {
    const [m, c, p, conf] = await Promise.all([
      base44.entities.Motoboy.list(),
      base44.entities.CheckIn.filter({ data: todayISO(), status: 'sucesso' }),
      base44.entities.Pagamento.list(),
      base44.entities.ConfigDiaria.list(),
    ]);
    setMotoboys(m);
    setCheckIns(c);
    setPayments(p);
    setConfig(conf[0] || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.CheckIn.subscribe(() => load());
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const ativos = motoboys.filter((m) => m.status === 'ativo');
  const checkedInIds = new Set(checkIns.map((c) => c.motoboy_id));
  const presentes = ativos.filter((m) => checkedInIds.has(m.id));
  const ausentes = ativos.filter((m) => !checkedInIds.has(m.id));
  const now = new Date();

  const folhaHoje = presentes.reduce((s, m) => s + getDiaria(m, config), 0);
  const folhaPrevistaMes = ativos.reduce((s, m) => s + getDiaria(m, config), 0) * 26;
  const totalPago = payments.reduce((s, p) => s + (p.valor || 0), 0);
  const totalPendente = Math.max(0, folhaPrevistaMes - totalPago);
  const valorSemanal = ativos.reduce((s, m) => s + getDiaria(m, config), 0) * 6;

  const alerts = [];
  ativos.forEach((m) => {
    const checkInsForMotoboy = checkIns; // today only
    const motoboyCheckIns = []; // would need full history for real alerts
  });
  // Simplified alerts based on missing PIX
  motoboys.forEach((m) => {
    if (m.status === 'ativo' && !m.pix) alerts.push({ type: 'pix', msg: `${m.nome} está com PIX pendente.`, tone: 'amber' });
    if (m.status === 'ativo' && (!m.telefone || !m.banco)) alerts.push({ type: 'incomplete', msg: `Cadastro de ${m.nome} está incompleto.`, tone: 'amber' });
  });
  if (ausentes.length > 0) {
    alerts.push({ type: 'absent', msg: `${ausentes.length} motoboy(s) ativo(s) ainda não fizeram check-in hoje.`, tone: 'amber' });
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Button variant="outline" onClick={() => setEmergencyOpen(true)} className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
          <ShieldAlert className="w-4 h-4" />
          Check-in Manual
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label="Cadastrados" value={motoboys.length} icon={Users} tone="blue" />
        <StatCard label="Ativos" value={ativos.length} icon={UserCheck} tone="green" />
        <StatCard label="Presentes hoje" value={presentes.length} icon={UserCheck} tone="green" />
        <StatCard label="Ausentes hoje" value={ausentes.length} icon={UserX} tone="red" />
        <StatCard label="Folha prevista (mês)" value={formatBRL(folhaPrevistaMes)} icon={Wallet} tone="gold" />
        <StatCard label="Valor semanal" value={formatBRL(valorSemanal)} icon={TrendingUp} tone="blue" />
        <StatCard label="Total pago" value={formatBRL(totalPago)} icon={Banknote} tone="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-1 border-border/60 shadow-sm">
          <h3 className="font-heading font-bold text-foreground mb-1">Total Pendente</h3>
          <p className="text-3xl font-bold text-amber-600">{formatBRL(totalPendente)}</p>
          <p className="text-xs text-muted-foreground mt-2">Folha prevista do mês menos pagamentos registrados</p>
        </Card>
        <Card className="p-5 lg:col-span-2 border-border/60 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="font-heading font-bold text-foreground">Alertas</h3>
          </div>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta no momento.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className={`flex items-center gap-2 text-sm rounded-lg p-2.5 ${a.tone === 'red' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${a.tone === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  {a.msg}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <LivePanel motoboys={motoboys} />

      <EmergencyCheckin open={emergencyOpen} onClose={() => setEmergencyOpen(false)} motoboys={motoboys} onDone={load} />
    </div>
  );
}