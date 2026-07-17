import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PinPad from '@/components/PinPad';
import { formatBRL, formatDate, formatDateTime, todayISO } from '@/lib/donbaron';
import {
  Bike, CheckCircle2, Clock, History, Calendar, Wallet, QrCode, User, LogOut, ChevronRight, Lock,
} from 'lucide-react';

const MENU = [
  { key: 'historico', label: 'Meu Histórico', icon: History },
  { key: 'dias', label: 'Dias Trabalhados', icon: Calendar },
  { key: 'pagamentos', label: 'Pagamentos', icon: Wallet },
  { key: 'pix', label: 'Meu PIX', icon: QrCode },
  { key: 'conta', label: 'Minha Conta', icon: User },
];

export default function Portal() {
  const { user, logout } = useAuth();
  const [motoboy, setMotoboy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState('');
  const [checkInResult, setCheckInResult] = useState(null);
  const [view, setView] = useState('home');
  const [history, setHistory] = useState({ checkIns: [], payments: [] });

  const loadMotoboy = async () => {
    if (!user?.email) return;
    const list = await base44.entities.Motoboy.filter({ email: user.email });
    if (list.length > 0) {
      setMotoboy(list[0]);
      const [ci, pay] = await Promise.all([
        base44.entities.CheckIn.filter({ motoboy_id: list[0].id }, '-data', 50),
        base44.entities.Pagamento.filter({ motoboy_id: list[0].id }, '-data', 50),
      ]);
      setHistory({ checkIns: ci, payments: pay });
    }
    setLoading(false);
  };

  useEffect(() => { loadMotoboy(); }, [user]);

  const todayCheckIn = history.checkIns.find((c) => c.data === todayISO() && c.status === 'sucesso');

  const handlePinComplete = async (pin) => {
    setPinError('');
    try {
      const res = await base44.functions.invoke('checkInMotoboy', {
        pin,
        dispositivo: navigator.userAgent.includes('Mobile') ? 'mobile' : 'web',
      });
      if (res.data?.success) {
        setCheckInResult(res.data.checkIn);
        setPinOpen(false);
        loadMotoboy();
      }
    } catch (e) {
      const err = e.response?.data?.error || e.message;
      if (err === 'check_in_duplicado') {
        setPinError('Você já fez check-in hoje.');
      } else {
        setPinError(err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!motoboy) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <p className="text-muted-foreground">Sua conta de motoboy não foi encontrada.</p>
        <Button variant="outline" onClick={() => logout()}>Sair</Button>
      </div>
    );
  }

  const firstName = motoboy.nome?.split(' ')[0] || 'Motoboy';

  // ===== CHECK-IN SUCCESS SCREEN =====
  if (checkInResult) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background px-6 text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">✅ Check-in realizado com sucesso!</h1>
          <p className="text-muted-foreground mt-2">{checkInResult.hora} • {formatDate(checkInResult.data)}</p>
        </div>
        <Button variant="outline" onClick={() => { setCheckInResult(null); setView('home'); }}>
          Voltar
        </Button>
      </div>
    );
  }

  // ===== MENU VIEWS =====
  if (view !== 'home') {
    const goBack = () => setView('home');
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goBack}>
              <ChevronRight className="w-5 h-5 rotate-180" />
            </Button>
            <h1 className="text-xl font-bold">
              {MENU.find((m) => m.key === view)?.label}
            </h1>
          </div>

          {view === 'historico' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Últimos check-ins</h3>
              {history.checkIns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum check-in registrado.</p>
              ) : (
                history.checkIns.slice(0, 10).map((c) => (
                  <div key={c.id} className="flex items-center justify-between bg-card border border-border/60 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-accent" />
                      <div>
                        <p className="text-sm font-medium">{formatDate(c.data)}</p>
                        <p className="text-xs text-muted-foreground">{c.hora} {c.tipo === 'manual' && '• Manual'}</p>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                ))
              )}
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-4">Últimos pagamentos</h3>
              {history.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
              ) : (
                history.payments.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-card border border-border/60 rounded-xl p-4">
                    <div>
                      <p className="text-sm font-medium">{formatDate(p.data)}</p>
                      <p className="text-xs text-muted-foreground capitalize">{p.forma} • {p.recibo}</p>
                    </div>
                    <p className="font-bold text-emerald-600">{formatBRL(p.valor)}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {view === 'dias' && (
            <div className="space-y-4">
              <div className="bg-card border border-border/60 rounded-xl p-6 text-center">
                <p className="text-4xl font-bold text-accent">{history.checkIns.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Total de dias trabalhados</p>
              </div>
              {history.checkIns.map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-card border border-border/60 rounded-xl p-4">
                  <span className="text-sm font-medium">{formatDate(c.data)}</span>
                  <span className="text-xs text-muted-foreground">{c.hora}</span>
                </div>
              ))}
            </div>
          )}

          {view === 'pagamentos' && (
            <div className="space-y-3">
              {history.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
              ) : (
                history.payments.map((p) => (
                  <div key={p.id} className="bg-card border border-border/60 rounded-xl p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{formatDate(p.data)}</span>
                      <span className="font-bold text-emerald-600">{formatBRL(p.valor)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">{p.forma}{p.banco && ` • ${p.banco}`}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.recibo}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {view === 'pix' && (
            <div className="bg-card border border-border/60 rounded-xl p-6 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Tipo da chave</p>
                <p className="font-medium capitalize mt-0.5">{motoboy.tipo_chave_pix || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Chave PIX</p>
                <p className="font-medium mt-0.5 break-all">{motoboy.pix || 'Não cadastrada'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Banco</p>
                <p className="font-medium mt-0.5">{motoboy.banco || '—'}</p>
              </div>
            </div>
          )}

          {view === 'conta' && (
            <div className="bg-card border border-border/60 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-2xl font-bold text-accent uppercase">
                  {firstName[0]}
                </div>
                <div>
                  <p className="font-bold text-lg">{motoboy.nome}</p>
                  <p className="text-sm text-muted-foreground">{motoboy.email}</p>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <div><p className="text-xs text-muted-foreground">Telefone</p><p className="font-medium">{motoboy.telefone || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Data de entrada</p><p className="font-medium">{formatDate(motoboy.data_entrada)}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p>
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${motoboy.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {motoboy.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div><p className="text-xs text-muted-foreground">Tempo de empresa</p><p className="font-medium">
                  {motoboy.data_entrada ? Math.floor((Date.now() - new Date(motoboy.data_entrada).getTime()) / 86400000) + ' dias' : '—'}
                </p></div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== HOME / CHECK-IN SCREEN =====
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-sidebar flex items-center justify-center">
              <Bike className="w-5 h-5 text-sidebar-primary" />
            </div>
            <span className="font-bold text-sm">DON BARON</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => logout()} className="text-muted-foreground gap-1.5">
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>

        {/* Greeting */}
        <div className="flex-1 flex flex-col justify-center text-center space-y-6">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Bom trabalho, {firstName}.</h1>
            <p className="text-muted-foreground mt-2">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          {/* Today's status */}
          <div className={`rounded-2xl p-6 border ${todayCheckIn ? 'border-emerald-200 bg-emerald-50' : 'border-border/60 bg-card'}`}>
            {todayCheckIn ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                <p className="font-semibold text-emerald-700">Você já fez check-in hoje</p>
                <p className="text-sm text-emerald-600">{todayCheckIn.hora}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Clock className="w-8 h-8 text-muted-foreground" />
                <p className="font-semibold text-foreground">Status de hoje</p>
                <p className="text-sm text-muted-foreground">Aguardando check-in</p>
              </div>
            )}
          </div>

          {/* Start work button */}
          {!todayCheckIn && (
            <Button
              size="lg"
              onClick={() => { setPinError(''); setPinOpen(true); }}
              className="h-14 text-base font-bold rounded-2xl gap-2"
            >
              <Lock className="w-5 h-5" />
              INICIAR TRABALHO
            </Button>
          )}
        </div>

        {/* Menu */}
        <div className="space-y-1.5 pt-8">
          {MENU.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border/60 hover:border-accent/40 hover:bg-accent/5 transition-all text-left"
            >
              <item.icon className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium flex-1">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      {/* PIN Dialog */}
      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Digite seu PIN</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <PinPad onComplete={handlePinComplete} error={pinError} loading={false} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}