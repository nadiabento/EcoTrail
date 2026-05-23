const express = require("express");
const router = express.Router();
const multer = require("multer"); // Middleware para tratamento de dados multipart/form-data (upload de ficheiros)
const path = require("path"); // Módulo nativo do Node para manipulação de caminhos de ficheiros
const fs = require("fs"); // Módulo nativo do Node para interação com o sistema de ficheiros (File System)

module.exports = (pgPool, mongoClient) => {
  // Define onde e como os ficheiros de imagem dos POIs serão guardados no servidor.
  const storage = multer.diskStorage({
    // 1. Destino do upload: Define a pasta física onde o ficheiro será guardado
    destination: function (req, file, cb) {
      // Constrói o caminho absoluto até à pasta pública de imagens de pontos de interesse
      const uploadDir = path.join(
        __dirname,
        "../../public/imagens/pontos_interesse",
      );
      // Garante que a pasta existe no servidor. Se não existir, o 'recursive: true' cria as pastas necessárias
      fs.mkdirSync(uploadDir, { recursive: true });
      // Retorna o caminho final para o Multer prosseguir (null significa zero erros)
      cb(null, uploadDir);
    },
    // 2. Nome do ficheiro: Define uma nomenclatura única para evitar sobreposição de ficheiros com o mesmo nome
    filename: function (req, file, cb) {
      // Cria um sufixo único baseado no timestamp atual mais um número aleatório gigante
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      // Junta o sufixo único com a extensão original do ficheiro (ex: .png, .jpg)
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });

  // FILTRO DE SEGURANÇA DE FICHEIROS (FILE FILTER)
  const fileFilter = (req, file, cb) => {
    // Expressão regular (Regex) para aceitar apenas formatos de imagem comuns
    const extensoesAceites = /jpeg|jpg|png/;
    // Valida o tipo MIME do ficheiro (enviado pelo browser)
    const mimetypeAceito = extensoesAceites.test(file.mimetype);
    // Valida a extensão do nome do ficheiro, convertendo-o primeiro para minúsculas
    const extnameAceito = extensoesAceites.test(
      path.extname(file.originalname).toLowerCase(),
    );
    // Se o tipo MIME e a extensão forem válidos, aceita o upload (true)
    if (mimetypeAceito && extnameAceito) {
      cb(null, true);
    } else {
      // Caso contrário, rejeita o upload retornando um erro explícito
      cb(
        new Error(
          "Formato inválido. Apenas são aceites ficheiros JPG, JPEG ou PNG.",
        ),
        false,
      );
    }
  };
  // INSTANCIAÇÃO E CONFIGURAÇÃO FINAL DO OBJETO UPLOAD
  // Une o armazenamento, o filtro de ficheiros e define os limites de tamanho.
  const upload = multer({
    storage: storage, // Utiliza a configuração de disco definida acima
    fileFilter: fileFilter, // Utiliza o filtro de extensões definido acima
    limits: { fileSize: 5 * 1024 * 1024 }, // Limita o tamanho máximo do ficheiro para 5 MegaBytes (5 * 1024 * 1024 bytes)
  });

  // ROTA 1: LISTA DE TRILHOS PARA O DROPDOWN (POSTGRESQL)
  // Alvo: Alimenta dinamicamente o menu de seleção do frontend com base no nível
  // de dificuldade escolhido pelo utilizador.
  router.get("/trilhos/:dificuldade", async (req, res) => {
    try {
      // Obtém o parâmetro da dificuldade enviado na rota (ex: 'Fácil', 'Moderado', 'Difícil' ou 'todos')
      const { dificuldade } = req.params;
      // Define a base da instrução SQL para selecionar apenas o identificador e o nome do percurso
      let query = "SELECT id, nome FROM trilhos";
      let params = []; // Array que armazenará os valores das variáveis para a query parametrizada

      // Se o utilizador NÃO escolheu filtrar por "todos", adiciona uma cláusula condicional à query
      if (dificuldade !== "todos") {
        query += " WHERE dificuldade = $1"; // Usa $1 para evitar ataques de SQL Injection
        params.push(dificuldade); // Adiciona o valor correspondente ao array de parâmetros
      }

      const result = await pgPool.query(query, params); // Executa a query estruturada no pool de ligações do PostgreSQL Neon

      res.json(result.rows); // Devolve as linhas de registos encontradas para o frontend em formato JSON array
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ROTA 2: GEOMETRIA DO TRILHO COMPLETO (ARQUITETURA HÍBRIDA: POSTGRES + MONGO)
  // Alvo: Obtém o desenho geográfico (linha do trilho) do PostGIS e cruza-o
  // diretamente com as descrições multimédia e detalhadas guardadas no MongoDB Atlas.
  router.get("/trilho-completo/:id", async (req, res) => {
    try {
      const idTrilho = parseInt(req.params.id); // Converte o ID dinâmico passado na rota para um número inteiro estável

      // 1. QUERY POSTGRESQL (Dados Espaciais):
      // Extrai os metadados do trilho e converte a coluna geométrica nativa para formato GeoJSON.
      // O ST_Transform garante a projeção 4326 legível pelo Leaflet no browser.
      const resultadoPostgres = await pgPool.query(
        "SELECT id, nome, distancia_km, dificuldade, ST_AsGeoJSON(ST_Transform(geom, 4326)) as geometry FROM trilhos WHERE id = $1",
        [idTrilho],
      );

      // Validação: Se o Postgres não retornar nenhuma linha, interrompe o processo indicando que o ID não existe
      if (resultadoPostgres.rows.length === 0) {
        return res.status(404).send("Trilho não encontrado no Postgres");
      }

      // Isola o registo obtido da base de dados relacional
      const trilhoRegisto = resultadoPostgres.rows[0];
      let conteudoMongo = null;

      // 2. CONSULTA AO MONGODB (Dados Multimédia / Textos Longos):
      // Bloco isolado com try/catch próprio para que, caso o MongoDB falhe ou bloqueie por IP,
      // a aplicação continue a funcionar e renderize pelo menos o mapa do trilho vindo do Postgres.
      try {
        const db = mongoClient.db("ecotrail"); // Seleciona a base de dados do Mongo
        const colecao = db.collection("conteudos_trilhos"); // Seleciona a coleção correspondente
        // Procura o documento cujo 'id_externo' coincida exatamente com o ID numérico do Postgres
        conteudoMongo = await colecao.findOne({ id_externo: idTrilho });
      } catch (mErr) {
        // Apenas regista a falha de ligação NoSQL no terminal do backend para não quebrar a experiência do utilizador
        console.log(
          "⚠️ Erro ao ligar ao Mongo para este trilho:",
          mErr.message,
        );
      }

      // 3. CONSTRUÇÃO E ENVIO DA RESPOSTA FORMATADA EM GEOJSON padronizado (Feature único)
      res.json({
        type: "Feature",
        // Converte a string de texto GeoJSON devolvida pelo PostGIS num objeto manipulável pelo JavaScript
        geometry: JSON.parse(trilhoRegisto.geometry),
        properties: {
          id: trilhoRegisto.id,
          nome: trilhoRegisto.nome,
          distancia: trilhoRegisto.distancia_km,
          dificuldade: trilhoRegisto.dificuldade,
          detalhes: conteudoMongo || null, // Se não encontrar dados no Mongo, envia null de forma limpa
        },
      });
    } catch (err) {
      // Captura erros estruturais ou de parsing nas tabelas relacionais
      console.error("Erro na rota completa:", err);
      res.status(500).send("Erro no servidor ao cruzar dados");
    }
  });

  // ROTA 3: DETALHES EXTRA DO TRILHO (MONGODB)
  // Alvo: Obtém de forma dedicada o documento NoSQL correspondente a um trilho.
  // Utilizado pelo frontend para preencher o painel expandido com dados longos
  // (fauna, flora, melhor época) e a galeria do carrossel de imagens.
  router.get("/detalhes-mongo/:id", async (req, res) => {
    try {
      // Converte o ID dinâmico da rota para um tipo inteiro compatível com a BD
      const idExterno = parseInt(req.params.id);
      // Estabelece a ligação à base de dados específica e à sua coleção
      const db = mongoClient.db("ecotrail");
      const colecao = db.collection("conteudos_trilhos");
      // Procura o primeiro documento que possua o campo 'id_externo' correspondente
      const detalhes = await colecao.findOne({ id_externo: idExterno });

      // Validação: Se não encontrar o documento no Mongo, responde com erro HTTP 404
      if (!detalhes) {
        return res.status(404).json({ error: "Não encontrado no Mongo" });
      }
      // Retorna o documento JSON completo com todas as propriedades multimédia
      res.json(detalhes);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro no MongoDB" });
    }
  });

  // ROTA 4: ANÁLISE ESPACIAL - PROXIMIDADE DE POIs POR CLIQUE (POSTGIS)
  // Alvo: Processa coordenadas de um clique no mapa obtidas via Leaflet e,
  // utilizando o motor de geoprocessamento do PostGIS, calcula quais os POIs
  // presentes num determinado raio esférico (em metros).
  // Nota: Esta rota possui prioridade e está declarada ANTES de rotas de ID genérico.
  router.get("/pois/proximos-ponto", async (req, res) => {
    // 1. Captura e limpeza de tipos dos dados recebidos na URL (Query Parameters)
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const raioMetros = parseInt(req.query.raio, 10) || 500; // Caso não seja passado, assume 500m
    const idTrilho = parseInt(req.query.id_trilho, 10);

    // 2. Validação preventiva de tipos: Rejeita pedidos com coordenadas inválidas ou vazias
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Coordenadas lat/lng inválidas." });
    }

    try {
      // 3. Montagem da Query SQL Espacial.
      // - Usamos o cast '::geography' para instruir o PostGIS a calcular a distância verdadeira
      //   sobre WGS84, eliminando desvios planos do ST_Transform(..., 3763).
      // - ST_MakePoint($1, $2) gera o ponto do clique na ordem padrão: $1 = Longitude, $2 = Latitude.
      // - ST_SetSRID(..., 4326) carimba o ponto com o sistema de coordenadas geográficas global.
      // - ST_Distance calcula a distância entre a coluna 'geom' e o ponto do clique do rato.
      // - ST_DWithin atua como o filtro do raio, ignorando registos fora da distância estipulada ($3).
      let queryPontoEspacial = `
      SELECT id, nome, tipo,
             ROUND(
               ST_Distance(
                 geom::geography, 
                 ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
               )::numeric, 1
             ) as distancia_metros
      FROM pontos_interesse
      WHERE ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
    `;

      // Array que popula os tokens de parametrização da string SQL base ($1, $2, $3)
      const params = [lng, lat, raioMetros];

      // 4. Cláusula Condicional (Filtro por Trilho Ativo):
      // Se houver um ID de trilho selecionado no frontend, acrescentamos dinamicamente
      // a verificação à query e mapeamos o valor para o novo marcador parâmetro ($4).
      if (!isNaN(idTrilho)) {
        queryPontoEspacial += ` AND id_trilho = $4`;
        params.push(idTrilho);
      }

      // Garante que o PostGIS ordena os registos de forma crescente (mais próximos primeiro)
      queryPontoEspacial += ` ORDER BY distancia_metros ASC;`;

      // Log informativo do início da análise no terminal
      console.log(
        `[PostGIS] Filtro ativo para o Trilho ID: ${idTrilho} em Lat: ${lat}, Lng: ${lng}`,
      );

      // 5. Executa a query final na pool de conexões do PostgreSQL Neon
      const resultado = await pgPool.query(queryPontoEspacial, params);
      console.log(
        `[PostGIS] Sucesso! Encontrados ${resultado.rows.length} pontos.`,
      );

      // 6. Envia o payload estruturado de volta ao browser
      res.json({
        sucesso: true,
        raio_pesquisa: raioMetros,
        total: resultado.rows.length,
        pontos: resultado.rows, // Array limpo com os resultados tabulares calculados
      });
    } catch (err) {
      // Captura e isola falhas críticas de sintaxe SQL ou falha na camada de geoprocessamento
      console.error("❌ ERRO INTERNO POSTGIS NA ROTA 8:", err.message);
      res.status(500).json({ error: "Erro na análise espacial do ponto." });
    }
  });

  // ROTA 5: OBTENÇÃO DE PONTOS DE INTERESSE DE UM TRILHO (POSTGRESQL / GeoJSON)
  // Alvo: Procura no PostGIS todos os POIs associados a um determinado trilho e
  // monta um objeto estruturado no padrão universal GeoJSON (FeatureCollection).
  // É esta rota que permite ao Leaflet desenhar os pins nativos originais no mapa.
  router.get("/pois/:trilhoId", async (req, res) => {
    try {
      // Converte o parâmetro dinâmico da rota para um número inteiro na base decimal
      const trilhoId = parseInt(req.params.trilhoId, 10);

      // CLÁUSULA DE SEGURANÇA CONTRA PRIORIDADES DO EXPRESS:
      // Se a rota receber um valor que não seja numérico (ex: a palavra "proximos-ponto"
      // devido a conflitos de ordem na leitura do Express), intercetamos o pedido imediatamente.
      // Retornamos um FeatureCollection vazio de forma limpa, poupando chamadas desnecessárias à BD.
      if (isNaN(trilhoId)) {
        return res.json({ type: "FeatureCollection", features: [] });
      }

      // Query SQL Espacial parametrizada:
      // - ST_AsGeoJSON converte a coluna binária de geometria num formato de texto legível de coordenadas.
      // - ST_Transform força a projeção para WGS84 (SRID 4326), padrão absoluto para mapas web.
      // - O cast '::json' converte a string de texto da geometria diretamente num tipo JSON nativo do Postgres.
      const query = `
        SELECT id, nome, tipo, ST_AsGeoJSON(ST_Transform(geom, 4326))::json AS geometry 
        FROM pontos_interesse 
        WHERE id_trilho = $1
      `;

      // Executa a instrução passando o ID seguro no array de substituição do token $1
      const resultado = await pgPool.query(query, [trilhoId]);

      // MAPEAMENTO MANUAL PARA PADRÃO GEOJSON (FeatureCollection):
      // Transforma as linhas de dados tabelares do Postgres na árvore de objetos estruturada do formato GIS.
      const geojson = {
        type: "FeatureCollection",
        features: resultado.rows.map((row) => ({
          type: "Feature",
          geometry: row.geometry, // Injeta o objeto de subcoordenadas gerado pelo PostGIS
          properties: {
            id_externo: row.id, // Mapeia a Chave Primária do Postgres como identificador externo para o Mongo
            nome: row.nome,
            tipo: row.tipo,
          },
        })),
      };

      // Envia o GeoJSON gerado para ser consumido pela camada L.geoJSON do Leaflet no frontend
      res.json(geojson);
    } catch (err) {
      // Regista eventuais falhas na consola do terminal e responde com status de erro crítico HTTP 500
      console.error("❌ ERRO NA ROTA DE POIS:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ROTA 6: DETALHES EXTENSOS DO POI (MONGODB)
  // Alvo: Sempre que o utilizador clica num marcador físico (pin) no mapa, o Leaflet
  // dispara esta rota em segundo plano usando o 'id_externo' para ir buscar
  // os dados NoSQL associados (como descrições detalhadas e URLs de fotografias).
  router.get("/detalhes-poi-mongo/:id_externo", async (req, res) => {
    try {
      // Garante que o identificador de cruzamento de dados é lido estritamente como um número inteiro
      const idProcuro = parseInt(req.params.id_externo, 10);
      // Instancia a ligação à base de dados NoSQL e seleciona a coleção de pontos de interesse
      const db = mongoClient.db("ecotrail");
      const colecao = db.collection("conteudos_pontos_interesse");
      // Executa uma pesquisa cirúrgica no cluster do MongoDB Atlas à procura do id_externo relacional
      const poiMongo = await colecao.findOne({ id_externo: idProcuro });

      // Validação: Se o ponto existir no Postgres mas ainda não tiver documentação fotográfica ou descritiva no Mongo
      if (!poiMongo) {
        return res.status(404).json({ error: "POI não encontrado no MongoDB" });
      }

      // Responde com o documento NoSQL rico em propriedades textuais e multimédia
      res.json(poiMongo);
    } catch (err) {
      // Regista erros de timeout ou infraestrutura NoSQL e emite resposta HTTP 500
      console.error("❌ Erro na Rota 6 do Mongo:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ROTA 7: CRIAÇÃO DE NOVO POI (TRANSAÇÃO HÍBRIDA INTEGRADA: POSTGRESQL + MONGO)
  // Alvo: Recebe dados textuais e um ficheiro de imagem através do middleware Multer.
  // Grava a geometria espacial no PostGIS, captura o ID gerado automaticamente
  // e utiliza-o como chave relacional (id_externo) para criar o documento NoSQL no MongoDB.
  router.post("/pois/criar", upload.single("imagem_poi"), async (req, res) => {
    try {
      // 1. Desestruturação das variáveis textuais enviadas no corpo do formulário (FormData)
      const { nome, tipo, lat, lng, id_trilho, descricao_curta } = req.body;

      // VALIDACÃO DE CAMPOS OBRIGATÓRIOS:
      // Se faltar algum dado essencial, impede a gravação para evitar inconsistências entre as BDs.
      if (!nome || !tipo || !lat || !lng || !id_trilho || !descricao_curta) {
        // Medida de segurança: Se o Multer já tiver guardado a imagem no disco, apaga o ficheiro (unlink)
        // para evitar acumular lixo ou ficheiros órfãos na pasta do servidor.
        if (req.file) fs.unlinkSync(req.file.path);
        return res
          .status(400)
          .json({ error: "Faltam campos obrigatórios no formulário." });
      }

      // 2. GRAVAÇÃO DOS DADOS ESPACIAIS NO POSTGRESQL:
      // - ST_MakePoint($4, $5) cria o ponto geográfico passando obrigatoriamente a ordem (Longitude, Latitude).
      // - ST_SetSRID(..., 4326) carimba o ponto explicitamente com o sistema de coordenadas WGS84.
      // - RETURNING id diz ao Postgres para devolver imediatamente a Chave Primária (SERIAL) gerada para este registo.
      const queryPostgres = `
        INSERT INTO pontos_interesse (nome, tipo, id_trilho, geom)
        VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326))
        RETURNING id;
      `;
      const resultadoPostgres = await pgPool.query(queryPostgres, [
        nome,
        tipo,
        id_trilho,
        lng, // $4 mapped to X (Longitude)
        lat, // $5 mapped to Y (Latitude)
      ]);

      // Captura o ID gerado na tabela relacional para servir de elo de ligação com o NoSQL
      const novoIdExterno = resultadoPostgres.rows[0].id;

      // 3. PREPARAÇÃO DO DOCUMENTO PARA O MONGODB:
      const db = mongoClient.db("ecotrail");
      const colecao = db.collection("conteudos_pontos_interesse");

      // Cria a estrutura do documento NoSQL associando o ID do Postgres ao campo 'id_externo'
      const novoDocMongo = {
        id_externo: novoIdExterno,
        id_trilho: parseInt(id_trilho, 10),
        nome: nome,
        tipo: tipo,
        descricao_curta: descricao_curta,
        imagens: [], // Inicia como array vazio preparado para links multimédia
      };

      // Se o utilizador tiver feito o upload de uma imagem válida no formulário
      if (req.file) {
        // Constrói o caminho relativo web (URL amigável para o browser) onde o ficheiro ficou alojado
        const caminhoImagemBrowser = `/imagens/pontos_interesse/${req.file.filename}`;
        // Adiciona o objeto com o link da imagem ao array de imagens do documento NoSQL
        novoDocMongo.imagens.push({ url: caminhoImagemBrowser });
      }

      // 4. INSERÇÃO ISOLADA NO MONGODB ATLAS:
      // Envolvida num bloco try/catch secundário para assegurar que, mesmo perante uma falha pontual
      // na cloud do Mongo, o servidor não quebre e responda de forma controlada ao utilizador.
      try {
        await colecao.insertOne(novoDocMongo);
        console.log(`✅ POI ${novoIdExterno} guardado no Mongo.`);
      } catch (mongoErr) {
        console.error("⚠️ Erro no MongoDB:", mongoErr.message);
      }

      // Responde com sucesso ao browser, enviando o ID gerado para manipulação no mapa
      res.json({ success: true, novoId: novoIdExterno });
    } catch (err) {
      // CAPTURA DE ERRO FATAL:
      console.error("❌ Erro fatal na rota de criação de POI:", err.message);
      // Caso ocorra uma quebra no meio da transação do Postgres, garante a limpeza do ficheiro de imagem físico
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: err.message });
    }
  });

  // ROTA 8: ANÁLISE ESPACIAL - ENCONTRAR POIs PRÓXIMOS A UM TRILHO INTEIRO (OPCIONAL)
  // Alvo: Executa um cruzamento espacial completo (CROSS JOIN) entre a linha
  // geográfica de um percurso e todos os pontos de interesse registados na base de dados,
  // devolvendo os POIs que orbitam o trilho a uma distância inferior ao raio definido.
  router.get("/trilhos/:id/pois-proximos", async (req, res) => {
    // Captura e converte os parâmetros passados por ID e Query String
    const trilhoId = parseInt(req.params.id, 10);
    const raioMetros = parseInt(req.query.raio, 10) || 500;

    try {
      // Query SQL de Geoprocessamento Avançado:
      // - ST_Transform(..., 3763) converte temporariamente as geometrias originais (4326)
      //   para o sistema planar oficial de Portugal Continental (PT-TM06), permitindo medições lineares exatas.
      // - ST_Distance calcula a menor distância métrica entre o traçado do trilho e cada ponto de interesse.
      // - ST_DWithin atua como uma zona de proteção (buffer lógico), restringindo a resposta aos POIs
      //   cuja distância linear ao percurso seja igual ou inferior a $2 metros.
      const queryProximidade = `
        SELECT p.id, p.nome, p.tipo,
               ROUND(ST_Distance(ST_Transform(t.geom, 3763), ST_Transform(p.geom, 3763))::numeric, 1) as distancia_metros
        FROM pontos_interesse p
        CROSS JOIN trilhos t
        WHERE t.id = $1
          AND ST_DWithin(ST_Transform(t.geom, 3763), ST_Transform(p.geom, 3763), $2)
        ORDER BY distancia_metros ASC;
      `;

      // Executa a consulta injetando o ID do trilho ($1) e o raio métrico ($2)
      const resultado = await pgPool.query(queryProximidade, [
        trilhoId,
        raioMetros,
      ]);

      // Retorna a lista de POIs encontrados ordenados do mais próximo ao mais distante do percurso
      res.json({ sucesso: true, pontos: resultado.rows });
    } catch (err) {
      // Trata erros de projeção de SRIDs ou quebra relacional na query complexa
      res.status(500).json({ error: err.message });
    }
  });

  // Retorna o objeto router inteiramente configurado para o ficheiro principal da aplicação (server.js / app.js)
  return router;
};
