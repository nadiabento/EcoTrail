const express = require("express");
const router = express.Router();

module.exports = (pgPool, mongoClient) => {
  // ROTA 1: Lista para o Dropdown (Postgres)
  router.get("/trilhos/:dificuldade", async (req, res) => {
    try {
      const { dificuldade } = req.params;
      let query = "SELECT id, nome FROM trilhos";
      let params = [];
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

  // ROTA 2: Geometria do Trilho (Postgres)
  router.get("/trilho-completo/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const query = `
                SELECT id, nome, dificuldade, distancia_km, 
                ST_AsGeoJSON(ST_Transform(geom, 4326)) as geometry 
                FROM trilhos WHERE id = $1`;
      const result = await pgPool.query(query, [id]);

      if (result.rows.length === 0)
        return res.status(404).send("Não encontrado");

      const row = result.rows[0];
      res.json({
        type: "Feature",
        geometry: JSON.parse(row.geometry),
        properties: {
          nome: row.nome,
          distancia: row.distancia_km,
          dificuldade: row.dificuldade,
        },
      });
    } catch (err) {
      res.status(500).send("Erro no Postgres");
    }
  });

  // ROTA 3: Detalhes Extra (MongoDB) - ESSENCIAL PARA O FETCH NÃO DAR 404
  router.get("/detalhes-mongo/:id", async (req, res) => {
    try {
      const idExterno = parseInt(req.params.id);
      // IMPORTANTE: Verifica se estes nomes batem com o teu MongoDB Atlas
      const db = mongoClient.db("EcoTrail");
      const colecao = db.collection("detalhes_trilhos");

      const detalhes = await colecao.findOne({ id_externo: idExterno });

      if (!detalhes) {
        return res.status(404).json({ mensagem: "Não encontrado no Mongo" });
      }
      res.json(detalhes);
    } catch (err) {
      res.status(500).json({ erro: "Erro no MongoDB" });
    }
  });

  // ROTA 4: Pontos de Interesse (Postgres)
  router.get("/pois/:trilho_id", async (req, res) => {
    try {
      const { trilho_id } = req.params;
      const query = `
                SELECT nome, tipo, ST_AsGeoJSON(ST_Transform(geom, 4326)) as geometry 
                FROM pontos_interesse WHERE id_trilho = $1`;
      const result = await pgPool.query(query, [trilho_id]);
      res.json({
        type: "FeatureCollection",
        features: result.rows.map((row) => ({
          type: "Feature",
          geometry: JSON.parse(row.geometry),
          properties: { nome: row.nome, tipo: row.tipo },
        })),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
