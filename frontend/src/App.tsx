import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { FileText, User } from 'lucide-react';
import './App.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const socket = io('http://localhost:3001');

function App() {
  const [data, setData] = useState<any>(null);
  // Simulating picking an active order
  const activePedidoId = 'PED-2024-0750'; 

  useEffect(() => {
    // Initial fetch
    axios.get(`http://localhost:3001/api/dashboard/${activePedidoId}`)
      .then(res => setData(res.data))
      .catch(err => console.error(err));

    socket.on('data_updated', (newData) => {
      console.log('Dados atualizados via Socket.io!', newData);
      // Re-filter for active pedido
      const pedidoBase = newData.pedidos.find((p: any) => p.PedidoID === activePedidoId);
      if(pedidoBase) {
        setData({
          pedido: pedidoBase,
          metricas: newData.metricas.filter((m: any) => m.PedidoID === activePedidoId),
          progresso: newData.progresso.filter((p: any) => p.PedidoID === activePedidoId),
          ocorrencias: newData.ocorrencias.filter((o: any) => o.PedidoID === activePedidoId),
        });
      }
    });

    return () => {
      socket.off('data_updated');
    };
  }, []);

  if (!data) return <div style={{padding: 40, fontFamily: 'Inter', textAlign: 'center'}}>Carregando o MKS Service...</div>;

  const { pedido, metricas, progresso, ocorrencias } = data;

  // Chart data config
  const labels = progresso.filter(p => p.Tipo === 'Previsto').map(p => p.Data);
  const chartData = {
    labels,
    datasets: [
      {
        type: 'line' as const,
        label: 'Previsto',
        borderColor: '#0a6b3f',
        backgroundColor: '#0a6b3f',
        borderWidth: 2,
        fill: false,
        data: progresso.filter(p => p.Tipo === 'Previsto').map(p => parseInt(p.Quantidade)),
      },
      {
        type: 'bar' as const,
        label: 'Realizado',
        backgroundColor: '#a8e6cf',
        data: progresso.filter(p => p.Tipo === 'Realizado').map(p => parseInt(p.Quantidade)),
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'right' as const } },
    scales: { y: { beginAtZero: true } }
  };

  return (
    <div className="dashboard-container">
      <div className="top-logo">
        <h1>MKS</h1>
        <span>Service ✓</span>
      </div>

      <div className="header-banner">
        <h2>Relatório de Status de Instalação</h2>
        <div>{new Date().toLocaleDateString('pt-BR')}</div>
      </div>

      <div className="grid-layout">
        {/* Visão Geral */}
        <div className="card">
          <div className="card-title">Visão Geral do Pedido</div>
          <div className="visao-geral">
            <div className="visao-info">
              <div className="info-box">
                <FileText className="info-icon" size={32} />
                <div>
                  <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>Número do Pedido:</div>
                  <strong>{pedido.PedidoID}</strong>
                </div>
              </div>
              <div className="info-box highlight">
                <User className="info-icon" size={32} />
                <div>
                  <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>Coordenador / Responsável:</div>
                  <strong>{pedido.Coordenador} / {pedido.ResponsavelCampo}</strong>
                </div>
              </div>
            </div>
            <div className="visao-chart">
              {/* Fake half donut representing the "78% NO PRAZO" */}
              <div style={{textAlign: 'center'}}>
                <div style={{fontSize: '0.9rem', fontWeight: 600, marginBottom: 10}}>STATUS GERAL DE CONCLUSÃO</div>
                <div style={{
                  width: 150, height: 75, background: 'conic-gradient(from 180deg at 50% 100%, var(--mks-green) 0%, var(--mks-green) 78%, #e2e8f0 78%, #e2e8f0 100%)', borderTopLeftRadius: '150px', borderTopRightRadius: '150px', margin: '0 auto', position: 'relative'
                }}>
                  <div style={{
                    width: 110, height: 55, backgroundColor: 'white', position: 'absolute', bottom: 0, left: 20, borderTopLeftRadius: '110px', borderTopRightRadius: '110px'
                  }}></div>
                </div>
                <div style={{marginTop: '-25px', fontSize: '2rem', fontWeight: 800, color: 'var(--mks-green)', position: 'relative', zIndex: 10}}>{(pedido.Percentual * 100).toFixed(0)}%</div>
                <div style={{color: 'var(--mks-green)', fontWeight: 700, fontSize: '0.9rem'}}>{pedido.StatusPrazo.toUpperCase()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Balanço Físico */}
        <div className="card">
          <div className="card-title">Balanço Físico de Equipamentos</div>
          <table className="mks-table">
            <thead>
              <tr>
                <th>Indicador Operacional</th>
                <th>Quantidade</th>
                <th>Percentual</th>
              </tr>
            </thead>
            <tbody>
              {metricas.map((m: any, idx: number) => (
                <tr key={idx}>
                  <td>{m.Indicador}</td>
                  <td>{m.Quantidade}</td>
                  <td>{(parseFloat(m.Percentual) * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-layout">
        {/* Gráfico */}
        <div className="card" style={{height: '350px'}}>
          <div className="card-title">Gráfico Evolutivo (Previsto vs Realizado)</div>
          <div style={{height: '250px'}}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Macro Etapas */}
        <div className="card">
          <div className="card-title">Macro-Etapas de Instalação (Evolução em %)</div>
          <div className="progress-container">
            <div className="progress-label"><span>Conformidade (medidas e elétrica)</span><span>100%</span></div>
            <div className="progress-bar-bg"><div className="progress-bar-fill" style={{width: '100%'}}></div></div>
          </div>
          <div className="progress-container">
            <div className="progress-label"><span>Alocação no fosso / docas</span><span>100%</span></div>
            <div className="progress-bar-bg"><div className="progress-bar-fill" style={{width: '100%'}}></div></div>
          </div>
          <div className="progress-container">
            <div className="progress-label"><span>Fixação</span><span>90%</span></div>
            <div className="progress-bar-bg"><div className="progress-bar-fill" style={{width: '90%'}}></div></div>
          </div>
          <div className="progress-container">
            <div className="progress-label"><span>Finalização e acabamento</span><span>50%</span></div>
            <div className="progress-bar-bg"><div className="progress-bar-fill" style={{width: '50%'}}></div></div>
          </div>
        </div>
      </div>

      {/* Tabela de Ocorrencias */}
      <div className="card">
        <div className="card-title">Ocorrências e Anomalias</div>
        <table className="mks-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Impacto</th>
              <th>Ação Corretiva</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ocorrencias.map((oc: any, idx: number) => {
               const statusType = oc.Status === 'Resolvido' ? 'resolvido' : oc.Status === 'Em andamento' ? 'emandamento' : 'atrasado';
               return (
                <tr key={idx}>
                  <td>{oc.Data}</td>
                  <td>{oc.Descricao}</td>
                  <td><b>{oc.Impacto.toUpperCase()}</b></td>
                  <td>{oc.AcaoCorretiva}</td>
                  <td>
                    <div className={`status-badge status-${statusType}`}>
                      {oc.Status.toUpperCase()}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
