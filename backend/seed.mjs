import { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";
import fs from "fs";
import path from "path";

async function boot() {
  const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));

  const serviceAccountAuth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet('1NNXGHxCv6TrlChOdLuZfTAv3Zdbibmsi11hh2hNnOhQ', serviceAccountAuth);

  try {
    await doc.loadInfo(); 
    console.log(`Buscando e mapeando planilhas no documento: ${doc.title}...`);

    // Helper folder
    const dataFolder = '../';

    // Ler arquivos txt (que estão em formato CSV)
    const readCsv = (filename) => {
        const raw = fs.readFileSync(path.join(dataFolder, filename), 'utf8').trim();
        const lines = raw.split('\n').filter(line => line.trim().length > 0);
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(line => line.split(',').map(c => c.trim()));
        return { headers, rows };
    };

    // --- LEITURA DOS ARQUIVOS ---
    const pedidosBase = readCsv('PedidoID,Coordenador,ResponsavelCam.txt');
    const pedidosStatus = readCsv('PedidoID,Percentual,StatusPrazo.txt');
    const eventos = readCsv('PedidoID,Data,Descricao,Impacto,Imp.txt');
    const progresso = readCsv('PedidoID,Data,Tipo,Quantidade.txt');
    const metricas = readCsv('PedidoID,Indicador,Quantidade,Perce.txt');

    // --- MESCLAR PEDIDOS COM STATUS PARA FICAR NA MESMA TABELA PRINCIPAL ---
    // Mapear status pelo PedidoID
    const mapStatus = {};
    pedidosStatus.rows.forEach(r => {
        // r = [PedidoID, Percentual, StatusPrazo]
        mapStatus[r[0]] = { percentual: r[1], status: r[2] };
    });

    const pedidosHeaders = [...pedidosBase.headers, 'Percentual', 'StatusPrazo'];
    const pedidosRows = pedidosBase.rows.map(r => {
        const pID = r[0];
        const statusData = mapStatus[pID] || { percentual: '0', status: 'Desconhecido' };
        return [...r, statusData.percentual, statusData.status];
    });

    console.log("Arquivos lidos com sucesso. Criando estruturação no Google Sheets...");

    // Helper function para criar Aba, limpar se existir, e inserir headers
    const recreateSheet = async (title, headerValues) => {
        let sheet = Object.values(doc.sheetsById).find(s => s.title === title);
        if (sheet) {
            await sheet.clear(); // Limpar tudo
            await sheet.setHeaderRow(headerValues);
        } else {
            sheet = await doc.addSheet({ title, headerValues });
        }
        return sheet;
    };

    // CRIAR ABAS E INSERIR DADOS
    // 1. Pedidos
    console.log(" -> Gerando aba: Pedidos...");
    const sheetPedidos = await recreateSheet('Pedidos', pedidosHeaders);
    if(pedidosRows.length > 0) await sheetPedidos.addRows(pedidosRows);

    // 2. Ocorrencias (Eventos)
    console.log(" -> Gerando aba: Ocorrencias...");
    const sheetEventos = await recreateSheet('Ocorrencias', eventos.headers);
    if(eventos.rows.length > 0) await sheetEventos.addRows(eventos.rows);

    // 3. Progresso_Diario
    console.log(" -> Gerando aba: Progresso_Diario...");
    const sheetProgresso = await recreateSheet('Progresso_Diario', progresso.headers);
    if(progresso.rows.length > 0) await sheetProgresso.addRows(progresso.rows);

    // 4. Metricas_Resumo
    console.log(" -> Gerando aba: Metricas_Resumo...");
    const sheetMetricas = await recreateSheet('Metricas_Resumo', metricas.headers);
    if(metricas.rows.length > 0) await sheetMetricas.addRows(metricas.rows);

    // Apagar alguma aba default inútil como "Página1" se ela não for o nosso db
    const targetToDelete = Object.values(doc.sheetsById).find(s => s.title === 'Página1' || s.title === 'Sheet1');
    if (targetToDelete && Object.values(doc.sheetsById).length > 1) {
        console.log(`Limpando aba padrão '${targetToDelete.title}'...`);
        await targetToDelete.delete();
    }

    console.log("✅ Estrutura criada com SUESSO lá no Google Sheets!");

  } catch (error) {
    console.error("❌ Erro:", error.message);
  }
}

boot();
