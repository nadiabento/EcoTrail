const express = require("express");
const { Pool } = require("pg"); // Cliente para PostgreSQL
const { MongoClient } = require("mongodb"); // Cliente para MongoDB
const cors = require("cors");
require("dotenv").config(); // Carrega as credenciais do ficheiro .env

const app = express();
const port = process.env.PORT || 3000;

// --- CONFIGURAÇÕES ---
app.use(cors()); // Permite que o frontend aceda à API
app.use(express.json()); // Permite ler JSON no corpo das requisições
app.use(express.static("public")); // Torna a pasta 'public' visível (HTML/CSS/JS)

// --- LIGAÇÕES ÀS BASES DE DADOS ---
// Ligação ao Postgres (Neon) usando a URL do .env
const pgPool = new Pool({ connectionString: process.env.PG_URL });

// Ligação ao MongoDB Atlas usando a URL do .env
const mongoClient = new MongoClient(process.env.MONGO_URL);

async function startDatabases() {
  try {
    await pgPool.query("SELECT NOW()"); // Teste rápido de ligação
    console.log("✅ Ligado ao PostgreSQL Neon");

    await mongoClient.connect();
    console.log("✅ Ligado ao MongoDB Atlas");
  } catch (err) {
    console.log("⚠️ Erro: Uma base de dados falhou, mas o servidor continua.");
  }
}
startDatabases();

// --- ROTAS DA API ---

/** * ROTA 1: Lista nomes de trilhos filtrados por dificuldade
 * Utilidade: Preencher o seletor (dropdown) do site
 */
app.get("/api/trilhos/:dificuldade", async (req, res) => {
  try {
    const { dificuldade } = req.params;
    let query = "SELECT id, nome FROM trilhos";
    let params = [];

    // Se não for "todos", adiciona filtro WHERE na query SQL
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

/** * ROTA 2: Trilho Completo (Híbrido)
 * Utilidade: Junta Geometria (Postgres) com Descrição/Fotos (Mongo)
 */
app.get("/api/trilho-completo/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // A. Busca no Postgres e converte a coluna 'geom' para formato GeoJSON
    const pgRes = await pgPool.query(
      "SELECT id, nome, dificuldade, distancia_km, ST_AsGeoJSON(geom) as geometry FROM trilhos WHERE id = $1",
      [id],
    );

    if (pgRes.rows.length === 0) return res.status(404).send("Não encontrado");

    // B. Busca no MongoDB usando o id_externo para cruzar os dados
    let infoExtra = null;
    try {
      infoExtra = await mongoClient
        .db("ecotrail")
        .collection("detalhes")
        .findOne({ id_externo: parseInt(id) });
    } catch (mErr) {
      console.log("Mongo offline");
    }

    // C. Monta a estrutura final que o mapa Leaflet exige
    const geoJSON = {
      type: "Feature",
      geometry: JSON.parse(pgRes.rows[0].geometry),
      properties: {
        nome: pgRes.rows[0].nome,
        distancia: pgRes.rows[0].distancia_km,
        dificuldade: pgRes.rows[0].dificuldade,
        detalhes: infoExtra || {
          descricao: "Sem descrição no Mongo.",
          fotos: [],
        },
      },
    };
    res.json(geoJSON);
  } catch (err) {
    res.status(500).send("Erro no servidor");
  }
});

/** * ROTA: Obter Pontos de Interesse (POIs) de um trilho específico
 */
app.get("/api/pois/:trilho_id", async (req, res) => {
  try {
    const { trilho_id } = req.params;

    // Busca os pontos, convertendo a geometria para GeoJSON
    const query = `
      SELECT id, nome, tipo, ST_AsGeoJSON(geom) as geometry 
      FROM pontos_interesse 
      WHERE id_trilho = $1
    `;

    const result = await pgPool.query(query, [trilho_id]);

    // Transformamos o resultado num FeatureCollection para o Leaflet ler facilmente
    const pois = {
      type: "FeatureCollection",
      features: result.rows.map((row) => ({
        type: "Feature",
        geometry: JSON.parse(row.geometry),
        properties: {
          nome: row.nome,
          tipo: row.tipo,
        },
      })),
    };

    res.json(pois);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`🚀 Servidor em http://localhost:${port}`));
