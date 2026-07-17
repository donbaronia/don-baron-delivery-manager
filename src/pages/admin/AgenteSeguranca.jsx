import AgentChat from '@/components/AgentChat';

const GREETING = `Olá! Sou o **Agente de Segurança** do DON BARON DELIVERY.

Posso monitorar e investigar:
- Tentativas repetidas de check-in
- Uso do PIN fora do horário permitido
- Tokens duplicados ou não consumidos
- Motoboys ausentes
- Comportamentos suspeitos

O que deseja investigar?`;

export default function AgenteSeguranca() {
  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-hidden">
        <AgentChat
          agentName="agente_seguranca"
          title="Agente de Segurança"
          subtitle="Monitoramento de segurança e integridade"
          greeting={GREETING}
        />
      </div>
    </div>
  );
}