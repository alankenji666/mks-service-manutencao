import { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";
import * as credentials from "../credentials.json";

async function testConnection() {
  console.log("Iniciando conexão com o Google Sheets...");
  
  // 1. Instanciar o autenticador JWT com a conta de serviço gerada
  const serviceAccountAuth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });

  // 2. Apontar para o ID da planilha do usuário
  const doc = new GoogleSpreadsheet('1NNXGHxCv6TrlChOdLuZfTAv3Zdbibmsi11hh2hNnOhQ', serviceAccountAuth);

  try {
    // 3. Tentar carregar as informações
    await doc.loadInfo(); 
    console.log(`✅ Sucesso absoluta! Conectado na planilha: " ${doc.title} "`);
    
    // Mostar um pequeno resumo
    const sheet = doc.sheetsByIndex[0];
    console.log(`   🔸 Primeira aba detectada: ${sheet.title}`);
    console.log(`   🔸 Total de linhas disponíveis na aba 1: ${sheet.rowCount}`);
    console.log("   --> Estamos prontos para ler e escrever dados via backend. 😉");
    
  } catch (error: any) {
    console.error("❌ Ocorreu um erro ao tentar conectar na planilha:");
    console.error(error.message);
  }
}

testConnection();
