const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

module.exports = (pgPool, mongoClient) => {
  // CONFIGURAÇÃO DO MULTER AJUSTADA À TUA ESTRUTURA
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      // Ajustado para apontar exatamente para public/imagens/pontos_interesse
      const uploadDir = path.join(
        __dirname,
        "../../public/imagens/pontos_interesse",
      );

      // Cria a pasta automaticamente caso ela não exista por algum motivo
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      // Gera um nome seguro e único para evitar ficheiros duplicados com o mesmo nome
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });

  // Filtro de segurança para aceitar apenas formatos comuns de imagem
  const fileFilter = (req, file, cb) => {
    const extensoesAceites = /jpeg|jpg|png/;
    const mimetypeAceito = extensoesAceites.test(file.mimetype);
    const extnameAceito = extensoesAceites.test(
      path.extname(file.originalname).toLowerCase(),
    );

    if (mimetypeAceito && extnameAceito) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Formato inválido. Apenas são aceites ficheiros JPG, JPEG ou PNG.",
        ),
        false,
      );
    }
  };

  const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limite máximo de 5MB por imagem
  });

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

  // ROTA 2: Geometria do Trilho Completo (Postgres + MongoDB para detalhes)
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

  // ROTA 4: Pontos de Interesse (Postgres) - Corrigida tabela para pontos_interesse
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
        return res.status(404).json({ error: "POI não encontrado no MongoDB" });
      }
      res.json(poiMongo);
    } catch (err) {
      console.error("❌ Erro na Rota 5 do Mongo:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ROTA 6: Criar Novo POI (Postgres + MongoDB Integrados)
  router.post("/pois/criar", upload.single("imagem_poi"), async (req, res) => {
    try {
      const { nome, tipo, lat, lng, id_trilho, descricao_curta } = req.body;

      // Validação dos dados textuais obrigatórios do formulário
      if (!nome || !tipo || !lat || !lng || !id_trilho || !descricao_curta) {
        if (req.file) fs.unlinkSync(req.file.path); // Apaga a imagem se faltarem campos
        return res
          .status(400)
          .json({ error: "Faltam campos obrigatórios no formulário." });
      }

      // 1. INSERÇÃO NO POSTGRESQL (Tabela: pontos_interesse)
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

      // 2. ESTRUTURAÇÃO DO DOCUMENTO MONGODB
      const db = mongoClient.db("ecotrail");
      const colecao = db.collection("conteudos_pontos_interesse");

      const novoDocMongo = {
        id_externo: novoIdExterno,
        id_trilho: parseInt(id_trilho, 10),
        nome: nome,
        tipo: tipo,
        descricao_curta: descricao_curta,
        imagens: [], // Mantém a estrutura de array do teu projeto
      };

      // Se o utilizador submeteu uma fotografia, gera o caminho correto para o frontend ler
      if (req.file) {
        // Como a pasta "public" é estática, o browser só precisa do caminho a partir dela:
        const caminhoImagemBrowser = `/imagens/pontos_interesse/${req.file.filename}`;

        // Insere no array respeitando o teu padrão de objeto { url: ... }
        novoDocMongo.imagens.push({ url: caminhoImagemBrowser });
      }

      // 3. GRAVAÇÃO NO MONGODB
      try {
        await colecao.insertOne(novoDocMongo);
        console.log(
          `✅ POI ${novoIdExterno} guardado no Mongo. Imagem associada: ${req.file ? "Sim" : "Não"}`,
        );
      } catch (mongoErr) {
        console.error(
          "⚠️ Erro ao criar documento correspondente no MongoDB:",
          mongoErr.message,
        );
      }

      // Envia resposta de sucesso de volta ao script.js
      res.json({ success: true, novoId: novoIdExterno });
    } catch (err) {
      console.error("❌ Erro fatal na rota de criação de POI:", err.message);
      if (req.file) fs.unlinkSync(req.file.path); // Limpa o lixo do disco se a BD falhar
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
