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

  // ROTA 2: Geometria do Trilho (Postgres + MongoDB para detalhes)
  router.get("/trilho-completo/:id", async (req, res) => {
    try {
      const idTrilho = parseInt(req.params.id);

      const resultadoPostgres = await pgPool.query(
        "SELECT id, nome, distancia_km, dificuldade, ST_AsGeoJSON(ST_Transform(geom, 4326)) as geometry FROM trilhos WHERE id = $1",
        [idTrilho],
      );

      if (resultadoPostgres.rows.length === 0) {
        return res.status(404).send("Trilho não encontrado no Postgres");
      }

      const trilhoRegisto = resultadoPostgres.rows[0];

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

      res.json({
        type: "Feature",
        geometry: JSON.parse(trilhoRegisto.geometry),
        properties: {
          id: trilhoRegisto.id,
          nome: trilhoRegisto.nome,
          distancia: trilhoRegisto.distancia_km,
          dificuldade: trilhoRegisto.dificuldade,
          detalhes: conteudoMongo || null,
        },
      });
    } catch (err) {
      console.error("Erro na rota completa:", err);
      res.status(500).send("Erro no servidor ao cruzar dados");
    }
  });

  // ROTA 3: Detalhes Extra do Trilho (MongoDB)
  router.get("/detalhes-mongo/:id", async (req, res) => {
    try {
      const idExterno = parseInt(req.params.id);

      const db = mongoClient.db("ecotrail");
      const colecao = db.collection("conteudos_trilhos");

      const detalhes = await colecao.findOne({ id_externo: idExterno });

      if (!detalhes) {
        return res.status(404).json({ error: "Não encontrado no Mongo" });
      }
      res.json(detalhes);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro no MongoDB" });
    }
  });

  // ROTA 4: Pontos de Interesse (Postgres)
  router.get("/pois/:trilhoId", async (req, res) => {
    try {
      const trilhoId = parseInt(req.params.trilhoId, 10);

      const query = `
        SELECT id, nome, tipo, ST_AsGeoJSON(ST_Transform(geom, 4326))::json AS geometry 
        FROM pontos_interesse 
        WHERE id_trilho = $1
      `;

      const resultado = await pgPool.query(query, [trilhoId]);

      const geojson = {
        type: "FeatureCollection",
        features: resultado.rows.map((row) => ({
          type: "Feature",
          geometry: row.geometry,
          properties: {
            id_externo: row.id,
            nome: row.nome,
            tipo: row.tipo,
          },
        })),
      };

      res.json(geojson);
    } catch (err) {
      console.error("❌ ERRO NA ROTA DE POIS:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ROTA 5: Detalhes do POI (MongoDB)
  router.get("/detalhes-poi-mongo/:id_externo", async (req, res) => {
    try {
      const idProcuro = parseInt(req.params.id_externo, 10);

      const db = mongoClient.db("ecotrail");
      const colecao = db.collection("conteudos_pontos_interesse");

      const poiMongo = await colecao.findOne({ id_externo: idProcuro });

      if (!poiMongo) {
        console.log(
          `⚠️ POI ${idProcuro} não encontrado na coleção conteudos_pontos_interesse.`,
        );
        return res.status(404).json({ error: "POI não encontrado no MongoDB" });
      }

      res.json(poiMongo);
    } catch (err) {
      console.error("❌ Erro na Rota 5 do Mongo:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ROTA 6: CRIAR NOVO POI (POSTGRES + MONGODB INTEGRADOS - CORRIGIDA E DENTRO DO BLOCO)
  router.post("/pois/criar", async (req, res) => {
    try {
      const { nome, tipo, lat, lng, id_trilho, descricao_curta } = req.body;

      if (!nome || !tipo || !lat || !lng || !id_trilho) {
        return res.status(400).json({ error: "Faltam campos obrigatórios." });
      }

      // 1. INSERÇÃO NO POSTGRESQL (Gera a geometria espacial)
      const queryPostgres = `
        INSERT INTO pontos_interesse (nome, tipo, id_trilho, geom)
        VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326))
        RETURNING id;
      `;

      const resultadoPostgres = await pgPool.query(queryPostgres, [
        nome,
        tipo,
        id_trilho,
        lng,
        lat,
      ]);

      const novoIdExterno = resultadoPostgres.rows[0].id;

      // 2. INSERÇÃO NO MONGODB AUTOMÁTICA (O valor extra para o teu projeto!)
      try {
        const db = mongoClient.db("ecotrail");
        const colecao = db.collection("conteudos_pontos_interesse");

        await colecao.insertOne({
          id_externo: novoIdExterno,
          id_trilho: id_trilho,
          nome: nome,
          tipo: tipo,
          descricao_curta:
            descricao_curta || "Sem descrição preenchida no mapa.",
          imagens: [], // Fica pronto em formato Array para adicionares fotos mais tarde no Compass
        });
        console.log(
          `✅ Documento para o POI ${novoIdExterno} criado com sucesso no MongoDB!`,
        );
      } catch (mongoErr) {
        // Se o Mongo falhar por algum motivo, avisa no terminal mas não crasha a resposta do utilizador
        console.error(
          "⚠️ Alerta: Ponto gravado no Postgres, mas falhou a criação automática no Mongo:",
          mongoErr.message,
        );
      }

      // Devolve a resposta de sucesso de volta para o teu frontend
      res.json({ success: true, novoId: novoIdExterno });
    } catch (err) {
      console.error("❌ Erro ao inserir POI no Postgres:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // O return router TEM de ser a última linha antes de fechar o module.exports
  return router;
};
