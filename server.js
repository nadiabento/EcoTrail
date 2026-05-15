const express = require("express");
const { Pool } = require("pg");
const { MongoClient } = require("mongodb");
const cors = require("cors");
require("dotenv").config();

// Importar as rotas
const trilhosRoutes = require("./src/routes/trilhos");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Configuração Postgres (Neon) com correção de SSL
const pgPool = new Pool({
  connectionString: process.env.PG_URL,
  ssl: { rejectUnauthorized: false },
});

// Configuração MongoDB
const mongoClient = new MongoClient(process.env.MONGO_URL);

async function startDatabases() {
  try {
    await pgPool.query("SELECT NOW()");
    console.log("✅ Ligado ao PostgreSQL Neon");
  } catch (err) {
    console.error("❌ ERRO NO POSTGRES:", err.message);
  }

  try {
    await mongoClient.connect();
    console.log("✅ Ligado ao MongoDB Atlas");
  } catch (err) {
    console.error("⚠️ MONGODB: Erro de ligação (provavelmente IP bloqueado).");
  }
}
startDatabases();

// Usar as Rotas (passando as ligações como argumentos)
app.use("/api", trilhosRoutes(pgPool, mongoClient));

app.listen(port, () => {
  console.log(`🚀 Servidor a correr em http://localhost:${port}`);
});
