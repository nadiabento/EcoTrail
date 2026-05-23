const express = require("express");
const { Pool } = require("pg"); // Importa a classe Pool do driver 'pg' para gerir conexões assíncronas ao PostgreSQL
const { MongoClient } = require("mongodb"); // Importa a classe MongoClient do driver oficial para conectar ao MongoDB
const cors = require("cors"); // Middleware para permitir requisições de origens diferentes (Cross-Origin Resource Sharing)
require("dotenv").config(); // Carrega as variáveis de ambiente do ficheiro '.env' para o objeto process.env

// Importa o módulo de rotas dos trilhos, que exporta uma função configurável
const trilhosRoutes = require("./src/routes/trilhos");

const app = express();
const port = process.env.PORT || 3000; // Define a porta do servidor (usa a variável de ambiente ou o padrão 3000)

// MIDDLEWARES GLOBAIS DO EXPRESS
app.use(cors()); // Ativa o CORS para evitar bloqueios de segurança nas chamadas da API pelo frontend
app.use(express.json()); // Permite ao Express interpretar corpos de requisições formatados em JSON (req.body)
app.use(express.static("public")); // Define a pasta 'public' como raiz para servir ficheiros estáticos (HTML, CSS, JS do mapa, imagens)

// CONFIGURAÇÃO DOS CLIENTES DE BASES DE DADOS
// 1. Inicialização do Pool de conexões do PostgreSQL (Neon Cloud)
const pgPool = new Pool({
  connectionString: process.env.PG_URL, // URI de conexão contendo credenciais e host da BD relacional
  ssl: { rejectUnauthorized: false }, // Permite conexões SSL seguras sem exigir a validação estrita de certificados locais
});

// 2. Inicialização do Cliente de conexão do MongoDB (Atlas Cloud)
const mongoClient = new MongoClient(process.env.MONGO_URL);

// FUNÇÃO ASSÍNCRONA DE ARRANQUE E VALIDAÇÃO DAS BASES DE DADOS
// Executa testes de conexão em background assim que o servidor inicia, garantindo
// que as credenciais e acessos de rede (firewalls/IPs) estão operacionais.
async function startDatabases() {
  // Teste de conexão: PostgreSQL
  try {
    // Executa uma query simples de sistema para validar a comunicação imediata
    await pgPool.query("SELECT NOW()");
    console.log("✅ Ligado ao PostgreSQL Neon");
  } catch (err) {
    console.error("❌ ERRO NO POSTGRES:", err.message);
  }

  // Teste de conexão: MongoDB
  try {
    // Executa uma query simples de sistema para validar a comunicação imediata
    await mongoClient.connect();
    console.log("✅ Ligado ao MongoDB Atlas");
  } catch (err) {
    console.error("⚠️ MONGODB: Erro de ligação (provavelmente IP bloqueado).");
  }
}
// Dispara o processo de conexão em segundo plano
startDatabases();

// CENTRALIZAÇÃO E INJEÇÃO DE DEPENDÊNCIAS NAS ROTAS
// Aplicamos o padrão de injeção de dependências: passamos as instâncias operacionais
// da 'pgPool' e do 'mongoClient' diretamente para a função do módulo de rotas.
// Isto permite que todas as sub-rotas consumam as bases de dados sem precisar de abrir novas conexões.
app.use("/api", trilhosRoutes(pgPool, mongoClient));

// ARRANQUE DO SERVIDOR HTTP
app.listen(port, () => {
  console.log(`🚀 Servidor a correr em http://localhost:${port}`);
});
