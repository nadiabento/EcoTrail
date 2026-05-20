const express = require("express");
const { Pool } = require("pg");
const { MongoClient } = require("mongodb");
const cors = require("cors");
require("dotenv").config();

const trilhosRoutes = require("./src/routes/trilhos");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const pgPool = new Pool({
  connectionString: process.env.PG_URL,
  ssl: { rejectUnauthorized: false },
});

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

// Rotas centralizadas (O Pool e o MongoClient injetados aqui)
app.use("/api", trilhosRoutes(pgPool, mongoClient));

app.listen(port, () => {
  console.log(`🚀 Servidor a correr em http://localhost:${port}`);
});
