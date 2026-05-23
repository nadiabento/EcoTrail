// VARIÁVEIS GLOBAIS DE CONTROLO DE ESTADO (MINDSHARE DO MAPA)
let nomeTrilhoAtual = ""; // Guarda o nome do percurso ativo em exibição
let descCurtaGuardada = ""; // Armazena a descrição resumida vinda do Postgres/Mongo
let descLongaHtmlGuardado = ""; // Memoriza o bloco HTML estruturado com dados do Mongo (Flora, Fauna)
let exibindoLonga = false; // Flag boleana para alternar o estado do painel de descrição (Curta vs Longa)
let listaImagensGuardadas = []; // Array com os URLs das imagens associadas ao trilho para o carrossel
let indiceImagemAtual = 0; // Índice do carrossel para paginação de fotos
let modoInsercaoPoi = false; // Flag que indica se o mapa está em modo "mira" para adicionar POI
let pontoCliqueCoords = null; // Regista um objeto { lat, lng } com o clique geográfico do utilizador
let marcadorClique = null; // Instância do marcador (pin vermelho) temporário no mapa

// Cache em memória dos pontos de interesse do trilho ativo para filtragem rápida no cliente
let todosOsPoisCarregados = [];

// CONFIGURAÇÃO DOS MAPAS DE BASE (TILE LAYERS - LEAFLET)
// 1. Camada OpenStreetMap (Rua / Vetorial)
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
});

// 2. Camada Esri (Satélite / Imagem Real)
const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Tiles &copy; Esri" },
);

// DICIONÁRIO E MAPEAMENTO DE ÍCONES PERSONALIZADOS POR CATEGORIA
// Define as propriedades estruturais comuns (tamanhos e âncoras de clique) para os marcadores
const baseIconParams = {
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  shadowSize: [41, 41],
};

// Mapeia strings de categorias da base de dados para instâncias de L.icon coloridas
const iconesPorTipo = {
  // --- VERDE (Natureza, Flora, Fauna, Parques) ---
  natureza: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  }),
  via: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  }),
  flora: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  }),
  fauna: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  }),
  "parque de lazer / merendas": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  }),

  // --- AZUL (Água, Pontes, Passadiços) ---
  água: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),
  "ponte / passadiço": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),
  "ponte / monument": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),

  // --- PRETO (Estruturas subterrâneas) ---
  túnel: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png",
  }),

  // --- AMARELO/LARANJA (Miradouros, Observação, Informação) ---
  "miradouro / observatório": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  }),
  informação: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png",
  }),

  // --- VIOLETA/ROXO (Património, Monumentos, História) ---
  património: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  }),
  "património / cultural": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  }),
  "ruína histórica": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  }),
  monumento: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  }),

  // --- VERMELHO E DOURADO (Pontos Críticos e Gerais) ---
  "início/fim": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  }),
  "ponto de interesse": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  }),
  infraestrutura: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png",
  }),

  // Marcador de Fallback caso o tipo na BD não encontre correspondência direta
  default: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),
};

// =========================================================================
// INICIALIZAÇÃO DO MAPA CONTEXTUALIZADO (AVEIRO DISTRICT)
// =========================================================================
const map = L.map("map", {
  center: [40.6443, -8.6455], // Centralizado na região lagunar de Aveiro
  zoom: 11,
  layers: [osm], // Define o OpenStreetMap como base padrão
  zoomControl: false, // Desativa o controlo de zoom nativo para reposicioná-lo
});

// Adiciona os controlos de interface customizados ao visual do mapa
L.control.zoom({ position: "bottomright" }).addTo(map);
L.control.layers({ "🗺️ Rua": osm, "🛰️ Satélite": satellite }).addTo(map);

// FUNÇÃO: ATUALIZAR DROPDOWN DE SELEÇÃO DE TRILHOS
async function atualizarListaTrilhos(dificuldade) {
  try {
    const response = await fetch(`/api/trilhos/${dificuldade}`);
    const trilhos = await response.json();
    const seletorTrilhos = document.getElementById("trail-selector");
    if (!seletorTrilhos) return;

    // Reseta o estado do elemento HTML select
    seletorTrilhos.innerHTML =
      '<option value="">-- Selecione um trilho --</option>';

    // Alimenta o seletor com novas opções baseadas nos registos tabulares do Postgres
    trilhos.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.nome;
      seletorTrilhos.appendChild(opt);
    });
  } catch (err) {
    console.error("Erro ao atualizar lista de trilhos na barra:", err);
  }
}

// FUNÇÃO 1: CARREGAR POIS DA API (PERSISTÊNCIA EM MEMÓRIA CLIENT-SIDE)
async function carregarPOIs(trilhoId) {
  if (!trilhoId || isNaN(trilhoId)) return;

  try {
    const response = await fetch(`/api/pois/${trilhoId}`);
    const data = await response.json();

    // Guarda as features GeoJSON do trilho na cache global para aplicar filtros sem repetir chamadas AJAX
    todosOsPoisCarregados = data.features || [];

    // Faz reset visual a todas as checkboxes de filtros na barra lateral
    document
      .querySelectorAll(".filtro-poi-check")
      .forEach((cb) => (cb.checked = true));

    // Renderiza inicialmente todos os pontos da coleção na camada do mapa
    renderizarFiltroCamada(todosOsPoisCarregados);
  } catch (err) {
    console.error("Erro POIs:", err);
  }
}

// FUNÇÃO 2: CENTRALIZAR E RENDERIZAR CAMADA GEOJSON DE POIS NO MAPA
function renderizarFiltroCamada(featuresParaExibir) {
  // Se já existir uma camada de pontos desenhada, remove-a para evitar duplicações de pins
  if (window.camadaPois) map.removeLayer(window.camadaPois);

  // Instancia um novo motor GeoJSON Leaflet mapeando os dados injetados
  window.camadaPois = L.geoJSON(
    {
      type: "FeatureCollection",
      features: featuresParaExibir,
    },
    {
      // Converte coordenadas geométricas puras em marcadores visuais L.marker
      pointToLayer: (feature, latlng) => {
        let tipoChave = feature.properties.tipo
          ? feature.properties.tipo.toLowerCase().trim()
          : "default";

        // Normalização forçada de Strings para mitigar divergências ortográficas de digitação da BD
        if (tipoChave === "água / rio") tipoChave = "água";
        if (tipoChave === "miradouro") tipoChave = "miradouro / observatório";

        // Regra de segurança: Força a cor vermelha para qualquer ponto de entrada ou saída do percurso
        if (
          tipoChave.includes("início") ||
          tipoChave.includes("fim") ||
          tipoChave === "início/fim"
        ) {
          return L.marker(latlng, { icon: iconesPorTipo["início/fim"] });
        }

        // Agrupa miradouros no padrão visual ecológico (verde da natureza)
        if (tipoChave === "miradouro / observatório") {
          return L.marker(latlng, { icon: iconesPorTipo["natureza"] });
        }

        // Retorna o marcador com o ícone mapeado no dicionário global ou o azul de fallback (default)
        return L.marker(latlng, {
          icon: iconesPorTipo[tipoChave] || iconesPorTipo["default"],
        });
      },

      // Vincula eventos e popups informativos a cada marcador instanciado
      onEachFeature: (feature, layer) => {
        const nomePostgres = feature.properties.nome || "Ponto de Interesse";

        // Aplica um popup temporário de carregamento estático
        layer.bindPopup(
          `<div><b>📍 ${nomePostgres}</b><br><small style="color:#7f8c8d;">A carregar detalhes do Mongo...</small></div>`,
          { className: "custom-poi-popup", maxWidth: 280 },
        );

        // Evento de Clique no Marcador: Dispara a consulta assíncrona NoSQL em tempo de execução
        layer.on("click", async (e) => {
          L.DomEvent.stopPropagation(e); // Evita o disparo do evento de clique geral do mapa
          const poiIdExterno =
            feature.properties.id_externo ||
            feature.properties.id ||
            feature.id;
          if (poiIdExterno) {
            // Vai buscar as imagens e textos extensos guardados na cloud NoSQL
            await mostrarDetalhesPOI(poiIdExterno, layer, feature.properties);
          }
        });
      },
    },
  ).addTo(map);
}

// FUNÇÃO 3: ESCUTA ATIVA DAS CHECKBOXES DO FILTRO CATEGÓRICO
document.querySelectorAll(".filtro-poi-check").forEach((checkbox) => {
  checkbox.addEventListener("click", function (evento) {
    evento.stopPropagation();

    if (!todosOsPoisCarregados || todosOsPoisCarregados.length === 0) return;

    // Converte todas as checkboxes marcadas no HTML num array plano de strings de valores (values)
    const gruposAtivos = Array.from(
      document.querySelectorAll(".filtro-poi-check:checked"),
    ).map((cb) => cb.value);

    // Filtração client-side em alta velocidade sobre a cache de POIs em memória
    const featuresFiltradas = todosOsPoisCarregados.filter((feature) => {
      if (!feature.properties || !feature.properties.tipo)
        return gruposAtivos.includes("geral");

      const tipoReal = feature.properties.tipo.toLowerCase().trim();
      let grupoAlvo = "geral";

      // Classificação lógica de mapeamento para os grupos do painel de filtros
      if (
        tipoReal.includes("início") ||
        tipoReal.includes("fim") ||
        tipoReal === "início/fim"
      ) {
        grupoAlvo = "critico";
      } else if (
        [
          "natureza",
          "via",
          "flora",
          "fauna",
          "parque de lazer / merendas",
          "miradouro / observatório",
          "miradouro",
        ].includes(tipoReal)
      ) {
        grupoAlvo = "natureza";
      } else if (
        [
          "água",
          "água / rio",
          "ponte / passadiço",
          "ponte / monumento",
        ].includes(tipoReal)
      ) {
        grupoAlvo = "agua";
      } else if (
        [
          "património",
          "património / cultural",
          "ruína histórica",
          "monumento",
        ].includes(tipoReal)
      ) {
        grupoAlvo = "patrimonio";
      } else if (
        [
          "ponto de interesse",
          "informação",
          "infraestrutura",
          "túnel",
        ].includes(tipoReal)
      ) {
        grupoAlvo = "geral";
      }

      // Retorna true se a categoria do ponto pertencer a um grupo selecionado no HTML
      return gruposAtivos.includes(grupoAlvo);
    });

    // Redesenha os pins atualizados no mapa
    renderizarFiltroCamada(featuresFiltradas);
  });
});

// FUNÇÃO: OBTENÇÃO E RENDERIZAÇÃO DE DETALHES DE POIs (MONGODB CLIENT FETCH)
async function mostrarDetalhesPOI(idExterno, layer, propertiesPostgres) {
  try {
    const res = await fetch(`/api/detalhes-poi-mongo/${idExterno}`);

    // Cenário de Fallback (HTTP 404): Trata pontos adicionados que ainda não receberam documentos NoSQL
    if (res.status === 404) {
      const conteudoNovoPoi = `
        <div class="poi-popup-content" style="font-family: inherit; color: #333; min-width: 220px; max-width: 280px;">
          <h3 style="margin: 0 0 5px 0; color: #3498db; font-size: 1.15em;">📍 ${propertiesPostgres.nome || "Novo Ponto"}</h3>
          <span style="background: #ebf5fb; color: #3498db; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: bold; display: inline-block;">
            ${propertiesPostgres.tipo || "Geral"}
          </span>
          <p style="margin: 10px 0 0 0; font-size: 0.9em; line-height: 1.4; text-align: justify; color: #7f8c8d; font-style: italic;">
            "Este ponto foi criado no mapa. Ainda não tem descrição detalhada ou fotos associadas no MongoDB."
          </p>
          <div style="margin-top: 10px; font-size: 0.7em; color: #95a5a6; border-top: 1px solid #eee; padding-top: 5px; text-align: right;">
            ID Ext (Postgres): ${idExterno}
          </div>
        </div>
      `;
      layer.setPopupContent(conteudoNovoPoi);
      return;
    }

    if (!res.ok) throw new Error(`Erro: ${res.status}`);
    const data = await res.json();

    // Injeta template alternativo caso o documento NoSQL não traga URLs de imagem válidas
    let htmlFoto = `
      <div class="zona-imagem-poi" style="border: 1px dashed #bdc3c7; background: #f8f9fa; height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #95a5a6;">
        <span style="font-size: 1.5em;">📸</span>
        <span style="font-size: 0.75em; margin-top: 5px;">Sem fotografia adicionada</span>
      </div>
    `;

    if (data.imagens && data.imagens.length > 0 && data.imagens[0] !== "") {
      const urlImagem = data.imagens[0].url || data.imagens[0];
      htmlFoto = `
      <div class="zona-imagem-poi">
        <img src="${urlImagem}" alt="${data.nome || "Imagem do ponto"}" />
      </div>
    `;
    }

    // Injeta dinamicamente os blocos de texto recolhidos diretamente do MongoDB Atlas
    const conteudoPopup = `
      <div class="poi-popup-content" style="font-family: inherit; color: #333; min-width: 240px; max-width: 280px;">
        <h3 style="margin: 0 0 5px 0; color: #2ecc71; font-size: 1.15em;">📍 ${data.nome || propertiesPostgres.nome}</h3>
        <span style="background: #e8f8f5; color: #2ecc71; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: bold; display: inline-block;">
          ${data.tipo || propertiesPostgres.tipo}
        </span>
        <p style="margin: 10px 0 0 0; font-size: 0.9em; line-height: 1.4; text-align: justify; color: #555; font-style: italic;">
          "${data.descricao_curta || "Sem descrição curta disponível no MongoDB."}"
        </p>
        ${htmlFoto}
        <div style="margin-top: 10px; font-size: 0.75em; color: #95a5a6; border-top: 1px solid #eee; padding-top: 5px; text-align: right;">
          ID Trilho: ${data.id_trilho} | Ext: ${data.id_externo}
        </div>
      </div>
    `;
    layer.setPopupContent(conteudoPopup);
  } catch (err) {
    console.error("Erro ao carregar POI do MongoDB:", err);
  }
}

// FUNÇÃO: DESENHAR TRAÇADO DO PERCURSO E MONTAR INTERFACE
async function carregarTrilho(id) {
  const painel = document.getElementById("trail-info-panel");

  // Se o utilizador limpar a seleção do dropdown, esconde os painéis e limpa o mapa
  if (!id) {
    if (painel) painel.style.display = "none";
    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON && layer !== window.camadaPois) {
        map.removeLayer(layer);
      }
    });
    if (window.camadaPois) map.removeLayer(window.camadaPois);
    return;
  }

  try {
    const response = await fetch(`/api/trilho-completo/${id}`);
    const data = await response.json();

    // Popula estados globais e limpa controlos visuais de alternância de visualização
    nomeTrilhoAtual = data.properties?.nome || "Trilho Sem Nome";
    descCurtaGuardada =
      data.properties?.detalhes?.descricao_curta ||
      "Sem descrição curta disponível.";
    exibindoLonga = false;

    if (painel) {
      painel.className = "painel-lateral-esquerdo";
      painel.style.display = "block";
    }

    // Inicializa visibilidade e limpa resquícios de queries anteriores no painel
    document.getElementById("painel-corpo").style.display = "block";
    document.querySelector(".btn-fechar-painel").style.display = "block";
    document.getElementById("detalhes-mongo").style.display = "none";
    document.getElementById("aviso-clique").style.display = "block";
    document.getElementById("zona-alternar").style.display = "none";
    document.getElementById("zona-carrossel").style.display = "none";
    if (document.getElementById("lista-pois-proximos"))
      document.getElementById("lista-pois-proximos").style.display = "none";
    if (document.getElementById("ul-pois-proximos"))
      document.getElementById("ul-pois-proximos").innerHTML = "";

    // Injeta metadados tabulares do percurso
    document.getElementById("info-name").textContent = nomeTrilhoAtual;
    const distValor =
      data.properties?.distancia || data.properties?.distancia_km || "0";
    document.getElementById("info-dist").textContent = distValor + " km";
    document.getElementById("info-diff").textContent =
      data.properties?.dificuldade || "n/a";

    const campoDescCurta = document.getElementById("info-desc-curta");
    campoDescCurta.style.display = "block";
    campoDescCurta.textContent = descCurtaGuardada;

    // Remove camadas GeoJSON geográficas de trilhos anteriores antes de injetar a nova
    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON && layer !== window.camadaPois) {
        map.removeLayer(layer);
      }
    });

    // Instancia o traçado vetorial geográfico do trilho vindo do PostGIS
    const camada = L.geoJSON(data, {
      style: { color: "#2ecc71", weight: 6, opacity: 0.8, cursor: "pointer" },
      onEachFeature: (feature, layer) => {
        // Permite expandir o painel descritivo ao clicar diretamente na linha do mapa
        layer.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          mostrarDetalhesNoPainel(id);
        });
      },
    }).addTo(map);

    // Ajusta o enquadramento (Bounding Box) da câmara do mapa para focar as linhas do percurso com padding espacial
    if (camada.getBounds().isValid()) {
      map.fitBounds(camada.getBounds(), { padding: [50, 50] });
    }

    // Carrega em background os marcadores associados a este trilho
    carregarPOIs(id);
  } catch (err) {
    console.error("Erro ao carregar percurso ao mudar no dropdown:", err);
  }
}

// FUNÇÃO: EXPANDIR PAINEL LATERAL COM ELEMENTOS MULTIMÉDIA DO MONGODB
async function mostrarDetalhesNoPainel(id) {
  const painel = document.getElementById("trail-info-panel");
  const zonaMongo = document.getElementById("detalhes-mongo");
  const descLongaArea = document.getElementById("info-desc-longa");
  const campoDescCurta = document.getElementById("info-desc-curta");
  const zonaAlternar = document.getElementById("zona-alternar");
  const btnAlternar = document.getElementById("btn-alternar-desc");
  const zonaCarrossel = document.getElementById("zona-carrossel");
  const imgExibida = document.getElementById("imagem-exibida");

  try {
    const res = await fetch(`/api/detalhes-mongo/${id}`);
    const data = await res.json();

    if (painel) {
      painel.classList.remove("minimizado");
      painel.classList.add("expandido");
    }

    document.getElementById("aviso-clique").style.display = "none";
    if (zonaAlternar) zonaAlternar.style.display = "block";
    if (btnAlternar)
      btnAlternar.textContent = "← Voltar para a descrição curta";
    exibindoLonga = true;

    if (campoDescCurta) campoDescCurta.style.display = "none";
    if (zonaMongo) zonaMongo.style.display = "block";

    // Inicialização do Carrossel de Fotos se existirem imagens salvas na coleção NoSQL
    if (data.imagens && data.imagens.length > 0) {
      listaImagensGuardadas = data.imagens;
      indiceImagemAtual = 0;
      const primeiraImagem = listaImagensGuardadas[indiceImagemAtual];
      if (imgExibida && primeiraImagem) {
        imgExibida.src = primeiraImagem.url || primeiraImagem;
      }
      if (zonaCarrossel) zonaCarrossel.style.display = "block";
      atualizarContadorCarrossel();
    } else {
      if (zonaCarrossel) zonaCarrossel.style.display = "none";
    }

    // Injeção de Templates de Strings contendo arrays textuais (Flora/Fauna) mapeados
    descLongaHtmlGuardado = `
      <div class="animacao-fade">
        <p style="line-height:1.6; color:#333; text-align:justify; font-size: 0.95em; margin-bottom: 0;">
          ${data.descricao_longa || "Não existe uma descrição detalhada disponível."}
        </p>
        <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
        <p>🌿 <b>Flora:</b> ${data.flora ? data.flora.join(", ") : "n/a"}</p>
        <p>🦆 <b>Fauna:</b> ${data.fauna ? data.fauna.join(", ") : "n/a"}</p>
        <p>📅 <b>Melhor Época:</b> ${data.melhor_epoca || "n/a"}</p>
      </div>
    `;
    if (descLongaArea) descLongaArea.innerHTML = descLongaHtmlGuardado;
  } catch (err) {
    console.error("Erro ao carregar dados do Mongo:", err);
  }
}

// FUNÇÕES: CONTROLO DA GALERIA / CARROSSEL DE IMAGENS DO TRILHO
function mudarImagemCarrossel(direcao, event) {
  if (event) event.stopPropagation();
  if (listaImagensGuardadas.length === 0) return;

  indiceImagemAtual += direcao;
  // Algoritmo circular para paginação contínua e infinita do carrossel
  if (indiceImagemAtual >= listaImagensGuardadas.length) indiceImagemAtual = 0;
  if (indiceImagemAtual < 0)
    indiceImagemAtual = listaImagensGuardadas.length - 1;

  const imgExibida = document.getElementById("imagem-exibida");
  if (imgExibida) {
    // Efeito suave de transição CSS controlando opacidade via temporizador setTimeout
    imgExibida.style.opacity = "0.3";
    setTimeout(() => {
      const imagemAlvo = listaImagensGuardadas[indiceImagemAtual];
      if (imagemAlvo) imgExibida.src = imagemAlvo.url || imagemAlvo;
      imgExibida.style.opacity = "1";
    }, 150);
  }
  atualizarContadorCarrossel();
}

function atualizarContadorCarrossel() {
  const contador = document.getElementById("contador-imagens");
  if (contador) {
    contador.textContent = `${indiceImagemAtual + 1} de ${listaImagensGuardadas.length}`;
  }
}

// FUNÇÕES: GESTÃO VISUAL DE ABAS E EVENTOS DE MINIMIZAÇÃO DE PAINÉIS
function alternarDescricao(event) {
  if (event) event.stopPropagation();
  const campoDescCurta = document.getElementById("info-desc-curta");
  const zonaMongo = document.getElementById("detalhes-mongo");
  const btnAlternar = document.getElementById("btn-alternar-desc");

  if (exibindoLonga) {
    if (zonaMongo) zonaMongo.style.display = "none";
    if (campoDescCurta) campoDescCurta.style.display = "block";
    if (btnAlternar)
      btnAlternar.textContent = "Ver detalhes completos (Longa) →";
    exibindoLonga = false;
  } else {
    if (campoDescCurta) campoDescCurta.style.display = "none";
    if (zonaMongo) zonaMongo.style.display = "block";
    if (btnAlternar)
      btnAlternar.textContent = "← Voltar para a descrição curta";
    exibindoLonga = true;
  }
}

function minimizarPainel(event) {
  if (event) event.stopPropagation();
  const painel = document.getElementById("trail-info-panel");
  const titulo = document.getElementById("info-name");
  if (!painel || !titulo) return;

  titulo.textContent = painel.classList.contains("expandido")
    ? `${nomeTrilhoAtual} (Detalhado)`
    : nomeTrilhoAtual;
  painel.classList.add("minimizado");
}

function reabrirPeloHeader() {
  const painel = document.getElementById("trail-info-panel");
  if (painel && painel.classList.contains("minimizado")) {
    painel.classList.remove("minimizado");
    document.getElementById("info-name").textContent = nomeTrilhoAtual;
  }
}

// Vinculação de escutas de eventos (Listeners) aos seletores de filtragem e dropdowns HTML
document
  .getElementById("difficulty-filter")
  .addEventListener("change", (e) => atualizarListaTrilhos(e.target.value));
document
  .getElementById("trail-selector")
  .addEventListener("change", (e) => carregarTrilho(e.target.value));

// Inicializa a árvore de componentes injetando a totalidade dos percursos guardados no Postgres
atualizarListaTrilhos("todos");

// BLOCO DE CONTROLO: ADIÇÃO E INSERÇÃO DE NOVOS POIs NO MAPA
const botaoPoiFixo = document.getElementById("btn-modo-poi");
if (botaoPoiFixo) {
  botaoPoiFixo.addEventListener("click", function (e) {
    e.stopPropagation();
    const trilhoSelecionado = document.getElementById("trail-selector").value;

    // Validação estrita: Bloqueia a inserção se não houver um percurso associado ativo
    if (!trilhoSelecionado) {
      alert("Por favor, selecione primeiro um trilho no menu superior!");
      return;
    }

    modoInsercaoPoi = !modoInsercaoPoi;
    if (modoInsercaoPoi) {
      botaoPoiFixo.textContent = "❌ Cancelar Inserção";
      botaoPoiFixo.style.backgroundColor = "#e74c3c";
      document.getElementById("map").style.cursor = "crosshair"; // Altera o ponteiro para mira de precisão
    } else {
      redefinirEstadoInsercao();
    }
  });
}

function redefinirEstadoInsercao() {
  modoInsercaoPoi = false;
  if (botaoPoiFixo) {
    botaoPoiFixo.textContent = "➕ Adicionar Ponto";
    botaoPoiFixo.style.backgroundColor = "#3498db";
  }
  document.getElementById("map").style.cursor = "";
}

// EVENTO: CLIQUE NO MAPA (GESTÃO INTELIGENTE DE MODOS: ANÁLISE VS INSERÇÃO)
map.on("click", function (e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  // MODO A: O Utilizador quer ADICIONAR um novo POI (Botão Ativo)
  if (modoInsercaoPoi) {
    // Captura o ID do trilho ativo para vincular ao novo ponto
    const idTrilho = document.getElementById("trail-selector").value;

    // Constrói dinamicamente o formulário HTML que vai aparecer dentro do Popup do Leaflet
    const conteudoFormulario = `
      <div style="font-family: inherit; min-width: 200px;">
        <h4 style="margin: 0 0 8px 0; color: #3498db;">➕ Novo Ponto de Interesse</h4>
        <div style="margin-bottom: 6px;">
          <label style="font-size: 0.8em; font-weight: bold;">Nome:</label>
          <input type="text" id="novo-poi-nome" style="width:100%; padding:4px; box-sizing:border-box;" placeholder="Ex: Miradouro da Ria">
        </div>
        <div style="margin-bottom: 6px;">
          <label style="font-size: 0.8em; font-weight: bold;">Categoria:</label>
          <select id="novo-poi-tipo" style="width:100%; padding:4px;">
            <option value="ponto de interesse">Ponto de Interesse Geral</option>
            <option value="natureza">Natureza / Flora / Fauna</option>
            <option value="água">Água / Rio / Passadiço</option>
            <option value="património">Património / Histórico</option>
            <option value="informação">Informação / Infraestrutura</option>
          </select>
        </div>
        <div style="margin-bottom: 8px;">
          <label style="font-size: 0.8em; font-weight: bold;">Descrição Curta:</label>
          <textarea id="novo-poi-desc" rows="2" style="width:100%; padding:4px; box-sizing:border-box;" placeholder="Breve descrição do local..."></textarea>
        </div>
        <div style="margin-bottom: 8px;">
          <label style="font-size: 0.8em; font-weight: bold;">Fotografia (Opcional):</label>
          <input type="file" id="novo-poi-imagem" accept="image/*" style="font-size:0.8em; width:100%;">
        </div>
        <button class="btn-poi-salvar" style="width: 100%; background: #2ecc71; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer;" 
                onclick="window.submeterNovoPoi(${lat}, ${lng}, ${idTrilho})">
          Gravar Ponto
        </button>
      </div>
    `;

    // Abre o popup do formulário exatamente no local clicado
    L.popup().setLatLng([lat, lng]).setContent(conteudoFormulario).openOn(map);

    // Encerra a execução da função aqui (impede que o modo de análise rode por engano!)
    return;
  }

  // MODO B: Modo Padrão (O Utilizador quer fixar posição para ANÁLISE ESPACIAL)
  pontoCliqueCoords = { lat, lng }; // Seta coordenadas na referência global de análise

  // Atualiza em tempo real as coordenadas geográficas no widget lateral direito
  document.getElementById("coordenadas-clique").innerText =
    `Lat: ${lat.toFixed(5)} | Lng: ${lng.toFixed(5)}`;

  // Se já existir um marcador vermelho de clique ativo no mapa, remove-o
  if (marcadorClique) {
    map.removeLayer(marcadorClique);
  }

  // Instancia o pin vermelho para indicar o início do raio de proximidade
  marcadorClique = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
  })
    .addTo(map)
    .bindPopup("<b>Estou aqui!</b><br>Ponto de partida da análise.")
    .openPopup();
});

// FUNÇÃO: SUBMETER FORMULÁRIO DE CRIACÃO DE NOVO POI (POST MULTIPART)
window.submeterNovoPoi = function (lat, lng, idTrilho) {
  const nome = document.getElementById("novo-poi-nome").value;
  const tipo = document.getElementById("novo-poi-tipo").value;
  const descricao = document.getElementById("novo-poi-desc").value;
  const inputImagem = document.getElementById("novo-poi-imagem");

  if (!nome || !descricao) {
    alert("Por favor, preencha o Nome e a Descrição!");
    return;
  }

  // Instancia um contentor FormData para suportar o empacotamento binário do upload de imagem (Multipart)
  const formData = new FormData();
  formData.append("nome", nome);
  formData.append("tipo", tipo);
  formData.append("descricao_curta", descricao);
  formData.append("lat", lat);
  formData.append("lng", lng);
  formData.append("id_trilho", idTrilho);

  // Anexa o ficheiro de imagem se o utilizador o tiver adicionado ao input
  if (inputImagem.files && inputImagem.files[0]) {
    formData.append("imagem_poi", inputImagem.files[0]);
  }

  const btnSalvar = document.querySelector(".btn-poi-salvar");
  if (btnSalvar) {
    btnSalvar.disabled = true;
    btnSalvar.textContent = "A gravar...";
  }

  // Dispara a requisição de gravação para a rota transacional híbrida do backend
  fetch("/api/pois/criar", {
    method: "POST",
    body: formData,
  })
    .then((res) => {
      if (!res.ok) throw new Error("Erro no servidor ao criar POI.");
      return res.json();
    })
    .then((data) => {
      alert(`Sucesso! O ponto "${nome}" foi registado.`);
      map.closePopup();
      redefinirEstadoInsercao();

      // Recarrega dinamicamente a camada geográfica de pontos para incluir o novo POI criado
      if (typeof carregarPOIs === "function") {
        carregarPOIs(idTrilho);
      }
    })
    .catch((err) => {
      console.error(err);
      alert("Erro ao gravar os dados nas bases de dados. Verifique a consola.");
      redefinirEstadoInsercao();
    });
};

// FUNÇÃO CENTRAL: CÁLCULO ESPACIAL DE PROXIMIDADE (REQUISIÇÃO POSTGIS CORRIGIDA)
// Captura as coordenadas do ponto fixado pelo clique do rato e consome a API do PostGIS
// para gerar uma listagem métrica ordenada de pontos de interesse limítrofes.
async function calcularPoisProximos(event) {
  if (event) event.stopPropagation();

  const raioMetros = document.getElementById("raio-distancia-postgis").value;
  const listaDiv = document.getElementById("lista-pois-proximos");
  const ulLista = document.getElementById("ul-pois-proximos");
  const btn = document.getElementById("btn-calcular-proximidade");

  // Validação explícita: Garante que o utilizador marcou a sua posição no mapa antes de chamar o PostGIS
  if (!pontoCliqueCoords || !pontoCliqueCoords.lat || !pontoCliqueCoords.lng) {
    alert(
      "Por favor, clica primeiro em qualquer ponto do mapa para definir a tua localização!",
    );
    return;
  }

  try {
    // Aplica estado de loading e feedback de bloqueio ao botão
    btn.disabled = true;
    btn.style.backgroundColor = "#7d3c98";
    btn.textContent = "⚙️ Query PostGIS...";

    const trilhoId = document.getElementById("trail-selector").value;

    if (!trilhoId) {
      alert(
        "Por favor, seleciona um trilho no menu superior antes de calcular!",
      );
      btn.disabled = false;
      btn.style.backgroundColor = "#9b59b6";
      btn.textContent = "🔍 Calcular a partir do Ponto";
      return;
    }

    // Faz o fetch passando as variáveis limpas na Query String para processamento esferoide no PostGIS
    const url = `/api/pois/proximos-ponto?lat=${pontoCliqueCoords.lat}&lng=${pontoCliqueCoords.lng}&raio=${raioMetros}&id_trilho=${trilhoId}`;

    const response = await fetch(url);
    const data = await response.json();

    ulLista.innerHTML = "";

    // Mapeamento e injeção do array de objetos 'data.pontos' devolvido com sucesso pela Rota 4 do backend
    if (!data.pontos || data.pontos.length === 0) {
      ulLista.innerHTML = `<li style="list-style: none; color: #7f8c8d; margin-left: -15px;">ℹ️ Nenhum POI a menos de ${raioMetros}m deste ponto.</li>`;
    } else {
      data.pontos.forEach((ponto) => {
        const li = document.createElement("li");
        li.style.marginBottom = "8px";
        // Insere dinamicamente os valores tabulares de distância calculados pelo motor relacional
        li.innerHTML = `<b>${ponto.nome}</b> <span style="color:#7f8c8d; font-size:0.9em;">(${ponto.tipo})</span><br>
                        📏 A <span style="color: #9b59b6; font-weight: bold;">${ponto.distancia_metros}m</span> de ti.`;
        ulLista.appendChild(li);
      });
    }

    // Exibe o painel lateral com a listagem preenchida e restaura controlos do botão
    listaDiv.style.display = "block";
    btn.disabled = false;
    btn.style.backgroundColor = "#9b59b6";
    btn.textContent = "🔍 Calcular a partir do Ponto";
  } catch (err) {
    // Alerta em caso de falha de parsing no JavaScript do cliente
    console.error("Erro real detetado no JS do Frontend:", err);
    alert("Erro na renderização dos dados. Verifica a consola (F12).");
    btn.disabled = false;
    btn.style.backgroundColor = "#9b59b6";
    btn.textContent = "🔍 Calcular a partir do Ponto";
  }
}

// Vincula explicitamente as funções globais ao objeto window do browser para garantir o escopo global de chamada
window.calcularPoisProximos = calcularPoisProximos;
window.alternarDescricao = alternarDescricao;
