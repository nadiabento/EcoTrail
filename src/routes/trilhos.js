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
      const idTrilho = parseInt(req.params.id);

      // USAR pgPool em vez de pool (para bater certo com o argumento da função)
      const resultadoPostgres = await pgPool.query(
        "SELECT id, nome, distancia_km, dificuldade, ST_AsGeoJSON(ST_Transform(geom, 4326)) as geometry FROM trilhos WHERE id = $1",
        [idTrilho],
      );

      if (resultadoPostgres.rows.length === 0) {
        return res.status(404).send("Trilho não encontrado no Postgres");
      }

      const trilhoRegisto = resultadoPostgres.rows[0];

      // Busca Detalhes no Mongo usando os teus nomes da imagem
      let conteudoMongo = null;
      try {
        const db = mongoClient.db("ecotrail");
        const colecao = db.collection("conteudos_trilhos");
        conteudoMongo = await colecao.findOne({ id_externo: idTrilho });
      } catch (mErr) {
        console.log(
          "⚠️ Erro ao ligar ao Mongo para este trilho:",
          mErr.message,
        );
      }

      // Devolve o GeoJSON perfeito para o Frontend
      res.json({
        type: "Feature",
        geometry: JSON.parse(trilhoRegisto.geometry),
        properties: {
          id: trilhoRegisto.id,
          nome: trilhoRegisto.nome,
          distancia: trilhoRegisto.distancia_km, // Repara se na BD se chama distancia ou distancia_km
          dificuldade: trilhoRegisto.dificuldade,
          detalhes: conteudoMongo || null,
        },
      });
    } catch (err) {
      console.error("Erro na rota completa:", err);
      res.status(500).send("Erro no servidor ao cruzar dados");
    }
  });

  // ROTA 3: Detalhes Extra (MongoDB)
  router.get("/detalhes-mongo/:id", async (req, res) => {
    try {
      const idExterno = parseInt(req.params.id);

      // Nomes exatos da tua imagem do MongoDB Atlas:
      const db = mongoClient.db("ecotrail");
      const colecao = db.collection("conteudos_trilhos");

      const detalhes = await colecao.findOne({ id_externo: idExterno });

      if (!detalhes) {
        return res.status(404).json({ mensagem: "Não encontrado no Mongo" });
      }
      res.json(detalhes);
    } catch (err) {
      console.error(err);
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
