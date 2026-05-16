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

// PROCURA POR ESTA ROTA NO TEU SERVER.JS E AJUSTA-A:
app.get("/api/pois/:trilhoId", async (req, res) => {
  try {
    const trilhoId = parseInt(req.params.trilhoId, 10);

    // O SELECT tem de ter a coluna ID!
    const query = `
      SELECT id, nome, tipo, ST_AsGeoJSON(ST_Transform(geom, 4326))::json AS geometry 
      FROM pois 
      WHERE id_trilho = $1
    `;

    const resultado = await pgPool.query(query, [trilhoId]);

    const geojson = {
      type: "FeatureCollection",
      features: resultado.rows.map((row) => ({
        type: "Feature",
        geometry: row.geometry,
        properties: {
          id_externo: row.id, // <--- Isto é o que envia o 320 para o frontend!
          nome: row.nome,
          tipo: row.tipo,
        },
      })),
    };

    res.json(geojson);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});
