import { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";
import fs from "fs";

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
    console.log(`✅ Sucesso absoluta! Conectado na planilha: " ${doc.title} "`);
    const sheet = doc.sheetsByIndex[0];
    console.log(`   🔸 Primeira aba detectada: ${sheet.title} (com ${sheet.rowCount} linhas)`);
  } catch (error) {
    console.error("❌ Erro:", error.message);
  }
}

boot();
