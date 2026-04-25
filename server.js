const express = require("express");
const { Pool } = require("pg");
const { MongoClient } = require("mongodb");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// --- 1. CONFIGURAÇÕES ---
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Serve o teu index.html automaticamente

// --- 2. LIGAÇÕES ---
const pgPool = new Pool({
  connectionString: process.env.PG_URL,
});

const mongoClient = new MongoClient(
  process.env.MONGO_URL || "mongodb://localhost:27017",
);

async function startDatabases() {
  try {
    await pgPool.query("SELECT NOW()");
    console.log("✅ Ligado ao PostgreSQL Neon");

    await mongoClient.connect();
    console.log("✅ Ligado ao MongoDB Atlas");
  } catch (err) {
    console.log(
      "⚠️ Nota: Uma das bases de dados falhou, mas o servidor continua ativo.",
    );
    console.log("Mensagem:", err.message);
  }
}
startDatabases();

// --- 3. ROTAS ---

app.get("/api/trilho-completo/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // A. BUSCA POSTGRES (Dados Espaciais)
    const pgRes = await pgPool.query(
      "SELECT *, ST_AsGeoJSON(geom) as geometry FROM trilhos WHERE id = $1",
      [id],
    );

    if (pgRes.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Trilho não encontrado no Postgres" });
    }

    // B. BUSCA MONGODB (Dados Descritivos)
    let infoExtra = null;
    try {
      infoExtra = await mongoClient
        .db("ecotrail")
        .collection("detalhes")
        .findOne({ id_externo: parseInt(id) });
    } catch (mErr) {
      console.log("ℹ Info: A ignorar MongoDB nesta resposta.");
    }

    // C. MONTAGEM DO GEOJSON HÍBRIDO
    const geoJSON = {
      type: "Feature",
      geometry: JSON.parse(pgRes.rows[0].geometry),
      properties: {
        nome: pgRes.rows[0].nome,
        dificuldade: pgRes.rows[0].dificuldade,
        distancia: pgRes.rows[0].distancia_km,
        detalhes: infoExtra || {
          descricao:
            "Detalhes do MongoDB ainda não carregados para este trilho.",
          fotos: [],
        },
      },
    };

    res.json(geoJSON);
  } catch (err) {
    console.error("❌ Erro fatal na API:", err.message);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor EcoTrail a correr em http://localhost:${port}`);
});
