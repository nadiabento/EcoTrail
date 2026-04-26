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
app.use(express.static("public")); // Serve automaticamente o index.html da pasta public

// --- 2. LIGAÇÕES ÀS BASES DE DADOS ---
const pgPool = new Pool({
  connectionString: process.env.PG_URL,
});

const mongoClient = new MongoClient(process.env.MONGO_URL);

async function startDatabases() {
  try {
    await pgPool.query("SELECT NOW()");
    console.log("✅ Ligado ao PostgreSQL Neon");

    await mongoClient.connect();
    console.log("✅ Ligado ao MongoDB Atlas");
  } catch (err) {
    console.log("⚠️ Erro de ligação, mas o servidor continua a tentar...");
    console.log("Mensagem:", err.message);
  }
}
startDatabases();

// --- 3. ROTAS DA API ---

/**
 * ROTA: Obter lista de trilhos filtrada por dificuldade
 * Usada para preencher o seletor de trilhos dinamicamente
 */
app.get("/api/trilhos/:dificuldade", async (req, res) => {
  try {
    const { dificuldade } = req.params;
    let query = "SELECT id, nome FROM trilhos";
    let params = [];

    // Se a dificuldade não for "todos", adicionamos o filtro SQL
    if (dificuldade !== "todos") {
      query += " WHERE dificuldade = $1";
      params.push(dificuldade);
    }

    const result = await pgPool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ROTA: Obter GeoJSON completo de um trilho (Postgres + MongoDB)
 */
app.get("/api/trilho-completo/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // 1. Busca no PostgreSQL (Geometria e dados básicos)
    const pgRes = await pgPool.query(
      "SELECT id, nome, dificuldade, distancia_km, ST_AsGeoJSON(geom) as geometry FROM trilhos WHERE id = $1",
      [id],
    );

    if (pgRes.rows.length === 0) {
      return res.status(404).json({ error: "Trilho não encontrado" });
    }

    // 2. Busca no MongoDB (Detalhes extras e fotos)
    let infoExtra = null;
    try {
      infoExtra = await mongoClient
        .db("ecotrail")
        .collection("detalhes")
        .findOne({ id_externo: parseInt(id) });
    } catch (mErr) {
      console.log("ℹ Info: Sem resposta do MongoDB para o ID:", id);
    }

    // 3. Formatação para o Padrão GeoJSON (que o Leaflet entende)
    const geoJSON = {
      type: "Feature",
      geometry: JSON.parse(pgRes.rows[0].geometry),
      properties: {
        nome: pgRes.rows[0].nome,
        dificuldade: pgRes.rows[0].dificuldade,
        distancia: pgRes.rows[0].distancia_km,
        detalhes: infoExtra || {
          descricao: "Descrição ainda não disponível no MongoDB.",
          fotos: [],
        },
      },
    };

    res.json(geoJSON);
  } catch (err) {
    console.error("❌ Erro na API:", err.message);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// --- 4. INICIALIZAÇÃO ---
app.listen(port, () => {
  console.log(`🚀 EcoTrail ativo em http://localhost:${port}`);
});
