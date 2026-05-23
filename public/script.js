let nomeTrilhoAtual = "";
let descCurtaGuardada = "";
let descLongaHtmlGuardado = "";
let exibindoLonga = false;
let listaImagensGuardadas = [];
let indiceImagemAtual = 0;
let modoInsercaoPoi = false;
let pontoCliqueCoords = null; // Guarda { lat, lng } do clique
let marcadorClique = null; // Guarda o pin temporário do mapa

// Variáveis globais para controlo dos POIs e Filtros
let todosOsPoisCarregados = [];

const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
});

const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Tiles &copy; Esri" },
);

const baseIconParams = {
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  shadowSize: [41, 41],
};

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
  "ponte / monumento": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),

  // --- PRETO (Túneis ou estruturas subterrâneas) ---
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

  // --- CINZENTO (Infraestruturas de suporte) ---
  infraestrutura: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png",
  }),

  // --- FALLBACK (Caso falte alguma coisa na BD) ---
  default: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),
};

const map = L.map("map", {
  center: [40.6443, -8.6455],
  zoom: 11,
  layers: [osm],
  zoomControl: false,
});

L.control.zoom({ position: "bottomright" }).addTo(map);
L.control.layers({ "🗺️ Rua": osm, "🛰️ Satélite": satellite }).addTo(map);

async function atualizarListaTrilhos(dificuldade) {
  try {
    const response = await fetch(`/api/trilhos/${dificuldade}`);
    const trilhos = await response.json();
    const seletorTrilhos = document.getElementById("trail-selector");
    if (!seletorTrilhos) return;

    seletorTrilhos.innerHTML =
      '<option value="">-- Selecione um trilho --</option>';
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

// 1. CARREGAR POIS DA API (GUARDA EM MEMÓRIA E ATIVA OS CHECKS)
async function carregarPOIs(trilhoId) {
  // Se o ID não for um número válido, não faz o fetch e sai da função em segurança
  if (!trilhoId || isNaN(trilhoId)) return;

  try {
    const response = await fetch(`/api/pois/${trilhoId}`);
    const data = await response.json();

    // Armazena as features na nossa variável global de filtragem
    todosOsPoisCarregados = data.features || [];

    // Faz reset visual a todas as checkboxes de filtros sempre que muda de trilho
    document
      .querySelectorAll(".filtro-poi-check")
      .forEach((cb) => (cb.checked = true));

    // Desenha inicialmente todas as categorias
    renderizarFiltroCamada(todosOsPoisCarregados);
  } catch (err) {
    console.error("Erro POIs:", err);
  }
}

// 2. FUNÇÃO CENTRAL PARA RENDERIZAR OS POIS CONFORME O FILTRO ATIVO
function renderizarFiltroCamada(featuresParaExibir) {
  if (window.camadaPois) map.removeLayer(window.camadaPois);

  window.camadaPois = L.geoJSON(
    {
      type: "FeatureCollection",
      features: featuresParaExibir,
    },
    {
      pointToLayer: (feature, latlng) => {
        // Lemos o tipo diretamente da BD, limpando espaços e pondo em minúsculas
        let tipoChave = feature.properties.tipo
          ? feature.properties.tipo.toLowerCase().trim()
          : "default";

        // --- NORMALIZAÇÃO FORÇADA DE SEGURANÇA ---
        if (tipoChave === "água / rio") tipoChave = "água";
        if (tipoChave === "miradouro") tipoChave = "miradouro / observatório";

        // Se na base de dados estiver escrito com espaços ou variações do início/fim, forçamos o ícone vermelho!
        if (
          tipoChave.includes("início") ||
          tipoChave.includes("fim") ||
          tipoChave === "início/fim"
        ) {
          return L.marker(latlng, {
            icon: iconesPorTipo["início/fim"], // Força o marcador VERMELHO da tua lista
          });
        }

        // Se for o miradouro, mantemos verde para o grupo da natureza
        if (tipoChave === "miradouro / observatório") {
          return L.marker(latlng, {
            icon: iconesPorTipo["natureza"],
          });
        }

        // Para todos os outros, usa o teu objeto iconesPorTipo mapeado
        return L.marker(latlng, {
          icon: iconesPorTipo[tipoChave] || iconesPorTipo["default"],
        });
      },
      onEachFeature: (feature, layer) => {
        const nomePostgres = feature.properties.nome || "Ponto de Interesse";
        layer.bindPopup(
          `<div><b>📍 ${nomePostgres}</b><br><small style="color:#7f8c8d;">A carregar detalhes do Mongo...</small></div>`,
          { className: "custom-poi-popup", maxWidth: 280 },
        );

        layer.on("click", async (e) => {
          L.DomEvent.stopPropagation(e);
          const poiIdExterno =
            feature.properties.id_externo ||
            feature.properties.id ||
            feature.id;
          if (poiIdExterno) {
            await mostrarDetalhesPOI(poiIdExterno, layer, feature.properties);
          }
        });
      },
    },
  ).addTo(map);
}
// 3. MONITORIZAÇÃO CLICÁVEL DAS CHECKBOXES DE FILTRAGEM
document.querySelectorAll(".filtro-poi-check").forEach((checkbox) => {
  checkbox.addEventListener("click", function (evento) {
    evento.stopPropagation();

    if (!todosOsPoisCarregados || todosOsPoisCarregados.length === 0) return;

    // Obtém os grupos ativos do HTML
    const gruposAtivos = Array.from(
      document.querySelectorAll(".filtro-poi-check:checked"),
    ).map((cb) => cb.value);

    // Filtra os pontos
    const featuresFiltradas = todosOsPoisCarregados.filter((feature) => {
      if (!feature.properties || !feature.properties.tipo)
        return gruposAtivos.includes("geral");

      const tipoReal = feature.properties.tipo.toLowerCase().trim();
      let grupoAlvo = "geral";

      // Grupo do Início/Fim (Vermelho) - Se contiver a palavra "início" ou "fim" vai para aqui
      if (
        tipoReal.includes("início") ||
        tipoReal.includes("fim") ||
        tipoReal === "início/fim"
      ) {
        grupoAlvo = "critico";
      }
      // Grupo Verde: Natureza e Observação
      else if (
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
      }
      // Grupo Azul: Recursos Hídricos e Pontes
      else if (
        [
          "água",
          "água / rio",
          "ponte / passadiço",
          "ponte / monumento",
        ].includes(tipoReal)
      ) {
        grupoAlvo = "agua";
      }
      // Grupo Roxo: Património e História
      else if (
        [
          "património",
          "património / cultural",
          "ruína histórica",
          "monumento",
        ].includes(tipoReal)
      ) {
        grupoAlvo = "patrimonio";
      }
      // Grupo Dourado/Geral: Pontos de Interesse Gerais e Informação
      else if (
        [
          "ponto de interesse",
          "informação",
          "infraestrutura",
          "túnel",
        ].includes(tipoReal)
      ) {
        grupoAlvo = "geral";
      }

      return gruposAtivos.includes(grupoAlvo);
    });

    renderizarFiltroCamada(featuresFiltradas);
  });
});

async function mostrarDetalhesPOI(idExterno, layer, propertiesPostgres) {
  try {
    const res = await fetch(`/api/detalhes-poi-mongo/${idExterno}`);

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
        <div style="margin-top: 10px; font-size: 0.7em; color: #95a5a6; border-top: 1px solid #eee; padding-top: 5px; text-align: right;">
          ID Trilho: ${data.id_trilho} | Ext: ${data.id_externo}
        </div>
      </div>
    `;
    layer.setPopupContent(conteudoPopup);
  } catch (err) {
    console.error("Erro ao carregar POI do MongoDB:", err);
  }
}

async function carregarTrilho(id) {
  const painel = document.getElementById("trail-info-panel");
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

    nomeTrilhoAtual = data.properties?.nome || "Trilho Sem Nome";
    descCurtaGuardada =
      data.properties?.detalhes?.descricao_curta ||
      "Sem descrição curta disponível.";
    exibindoLonga = false;

    if (painel) {
      painel.className = "painel-lateral-esquerdo";
      painel.style.display = "block";
    }

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

    document.getElementById("info-name").textContent = nomeTrilhoAtual;
    const distValor =
      data.properties?.distancia || data.properties?.distancia_km || "0";
    document.getElementById("info-dist").textContent = distValor + " km";
    document.getElementById("info-diff").textContent =
      data.properties?.dificuldade || "n/a";

    const campoDescCurta = document.getElementById("info-desc-curta");
    campoDescCurta.style.display = "block";
    campoDescCurta.textContent = descCurtaGuardada;

    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON && layer !== window.camadaPois) {
        map.removeLayer(layer);
      }
    });

    const camada = L.geoJSON(data, {
      style: { color: "#2ecc71", weight: 6, opacity: 0.8, cursor: "pointer" },
      onEachFeature: (feature, layer) => {
        layer.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          mostrarDetalhesNoPainel(id);
        });
      },
    }).addTo(map);

    if (camada.getBounds().isValid()) {
      map.fitBounds(camada.getBounds(), { padding: [50, 50] });
    }

    carregarPOIs(id);
  } catch (err) {
    console.error("Erro ao carregar percurso ao mudar no dropdown:", err);
  }
}

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

function mudarImagemCarrossel(direcao, event) {
  if (event) event.stopPropagation();
  if (listaImagensGuardadas.length === 0) return;

  indiceImagemAtual += direcao;
  if (indiceImagemAtual >= listaImagensGuardadas.length) indiceImagemAtual = 0;
  if (indiceImagemAtual < 0)
    indiceImagemAtual = listaImagensGuardadas.length - 1;

  const imgExibida = document.getElementById("imagem-exibida");
  if (imgExibida) {
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
  if (contador)
    contador.textContent = `${indiceImagemAtual + 1} de ${listaImagensGuardadas.length}`;
}

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

document
  .getElementById("difficulty-filter")
  .addEventListener("change", (e) => atualizarListaTrilhos(e.target.value));
document
  .getElementById("trail-selector")
  .addEventListener("change", (e) => carregarTrilho(e.target.value));

atualizarListaTrilhos("todos");

const botaoPoiFixo = document.getElementById("btn-modo-poi");
if (botaoPoiFixo) {
  botaoPoiFixo.addEventListener("click", function (e) {
    e.stopPropagation();
    const trilhoSelecionado = document.getElementById("trail-selector").value;
    if (!trilhoSelecionado) {
      alert("Por favor, selecione primeiro um trilho no menu superior!");
      return;
    }

    modoInsercaoPoi = !modoInsercaoPoi;
    if (modoInsercaoPoi) {
      botaoPoiFixo.textContent = "❌ Cancelar Inserção";
      botaoPoiFixo.style.backgroundColor = "#e74c3c";
      document.getElementById("map").style.cursor = "crosshair";
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

// Configura o clique no mapa para capturar a posição do utilizador
map.on("click", function (e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  pontoCliqueCoords = { lat, lng };

  // Atualiza o texto no painel direito
  document.getElementById("coordenadas-clique").innerText =
    `Lat: ${lat.toFixed(5)} | Lng: ${lng.toFixed(5)}`;

  // Remove o pin anterior se já existir
  if (marcadorClique) {
    map.removeLayer(marcadorClique);
  }

  // Cria um novo marcador vermelho ou personalizado para destacar onde o utilizador clicou
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

window.submeterNovoPoi = function (lat, lng, idTrilho) {
  const nome = document.getElementById("novo-poi-nome").value;
  const tipo = document.getElementById("novo-poi-tipo").value;
  const descricao = document.getElementById("novo-poi-desc").value;
  const inputImagem = document.getElementById("novo-poi-imagem");

  if (!nome || !descricao) {
    alert("Por favor, preencha o Nome e a Descrição!");
    return;
  }

  const formData = new FormData();
  formData.append("nome", nome);
  formData.append("tipo", tipo);
  formData.append("descricao_curta", descricao);
  formData.append("lat", lat);
  formData.append("lng", lng);
  formData.append("id_trilho", idTrilho);

  if (inputImagem.files && inputImagem.files[0]) {
    formData.append("imagem_poi", inputImagem.files[0]);
  }

  const btnSalvar = document.querySelector(".btn-poi-salvar");
  if (btnSalvar) {
    btnSalvar.disabled = true;
    btnSalvar.textContent = "A gravar...";
  }

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

// ROTA 7 FRONTEND: CÁLCULO ESPACIAL DE PROXIMIDADE (POSTGIS)

async function calcularPoisProximos(event) {
  if (event) event.stopPropagation();

  const raioMetros = document.getElementById("raio-distancia-postgis").value;
  const listaDiv = document.getElementById("lista-pois-proximos");
  const ulLista = document.getElementById("ul-pois-proximos");
  const btn = document.getElementById("btn-calcular-proximidade");

  // Validação segura do ponto de clique
  if (!pontoCliqueCoords || !pontoCliqueCoords.lat || !pontoCliqueCoords.lng) {
    alert(
      "Por favor, clica primeiro em qualquer ponto do mapa para definir a tua localização!",
    );
    return;
  }

  try {
    btn.disabled = true;
    btn.style.backgroundColor = "#7d3c98";
    btn.textContent = "⚙️ Query PostGIS...";

    // Captura o ID do trilho ativo no teu dropdown
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

    // ADICIONADO: Enviamos também o id_trilho na rota!
    const url = `/api/pois/proximos-ponto?lat=${pontoCliqueCoords.lat}&lng=${pontoCliqueCoords.lng}&raio=${raioMetros}&id_trilho=${trilhoId}`;

    const response = await fetch(url);
    const data = await response.json();

    ulLista.innerHTML = "";

    if (!data.pontos || data.pontos.length === 0) {
      ulLista.innerHTML = `<li style="list-style: none; color: #7f8c8d; margin-left: -15px;">ℹ️ Nenhum POI a menos de ${raioMetros}m deste ponto.</li>`;
    } else {
      data.pontos.forEach((ponto) => {
        const li = document.createElement("li");
        li.style.marginBottom = "8px";
        li.innerHTML = `<b>${ponto.nome}</b> <span style="color:#7f8c8d; font-size:0.9em;">(${ponto.tipo})</span><br>
                        📏 A <span style="color: #9b59b6; font-weight: bold;">${ponto.distancia_metros}m</span> de ti.`;
        ulLista.appendChild(li);
      });
    }

    listaDiv.style.display = "block";
    btn.disabled = false;
    btn.style.backgroundColor = "#9b59b6";
    btn.textContent = "🔍 Calcular a partir do Ponto";
  } catch (err) {
    console.error("Erro detalhado no fetch:", err);
    alert("Erro ao comunicar com o servidor.");
    btn.disabled = false;
    btn.style.backgroundColor = "#9b59b6";
    btn.textContent = "🔍 Calcular a partir do Ponto";
  }
}
window.calcularPoisProximos = calcularPoisProximos;

window.alternarDescricao = alternarDescricao;
