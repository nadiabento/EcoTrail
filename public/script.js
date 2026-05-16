// --- 1. VARIÁVEIS GLOBAIS DE ESTADO ---
let nomeTrilhoAtual = "";
let descCurtaGuardada = "";
let descLongaHtmlGuardado = "";
let exibindoLonga = false;
let listaImagensGuardadas = [];
let indiceImagemAtual = 0;

// --- 2. CONFIGURAÇÃO DE CAMADAS DO MAPA ---
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
});

const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Tiles &copy; Esri" },
);

// --- 3. ÍCONES PARA POIS ---
const baseIconParams = {
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  shadowSize: [41, 41],
};

const iconesPorTipo = {
  Natureza: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  }),
  Via: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  }),
  Água: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),
  "Ponte / Passadiço": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-cyan.png",
  }),
  Túnel: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png",
  }),
  Miradouro: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  }),
  "Miradouro / Observatório": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  }),
  Informação: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png",
  }),
  Património: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  }),
  "Ruína Histórica": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  }),
  "Ponte / Monumento": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  }),
  "Ponto de Interesse": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  }),
  "Início/Fim": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  }),
  Infraestrutura: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png",
  }),
  default: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),
};

// --- 4. INICIALIZAÇÃO DO MAPA ---
const map = L.map("map", {
  center: [40.6443, -8.6455],
  zoom: 11,
  layers: [osm],
  zoomControl: false,
});

L.control.zoom({ position: "bottomright" }).addTo(map);
L.control.layers({ "🗺️ Rua": osm, "🛰️ Satélite": satellite }).addTo(map);

// --- 5. FUNÇÕES DE CARREGAMENTO ---

async function atualizarListaTrilhos(dificuldade) {
  try {
    const response = await fetch(`/api/trilhos/${dificuldade}`);
    const trilhos = await response.json();

    // Pegar o seletor diretamente pelo ID do teu HTML
    const seletorTrilhos = document.getElementById("trail-selector");
    if (!seletorTrilhos) return;

    // Limpa a lista antiga
    seletorTrilhos.innerHTML =
      '<option value="">-- Selecione um trilho --</option>';

    // Adiciona os novos trilhos vindos da BD
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

async function carregarPOIs(trilhoId) {
  try {
    const response = await fetch(`/api/pois/${trilhoId}`);
    const data = await response.json();
    if (window.camadaPois) map.removeLayer(window.camadaPois);

    window.camadaPois = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        const tipo = feature.properties.tipo
          ? feature.properties.tipo.trim()
          : "default";
        return L.marker(latlng, {
          icon: iconesPorTipo[tipo] || iconesPorTipo["default"],
        });
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(
          `<b>📍 ${feature.properties.nome}</b><br><small>${feature.properties.tipo}</small>`,
        );
      },
    }).addTo(map);
  } catch (err) {
    console.error("Erro POIs:", err);
  }
}

// Carrega o resumo inicial do trilho (Postgres)
async function carregarTrilho(id) {
  const painel = document.getElementById("trail-info-panel");
  if (!id) {
    if (painel) painel.style.display = "none";
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

    // Forçar o estado inicial correto (Aberto e sem classes extras)
    if (painel) {
      painel.className = "painel-lateral-esquerdo";
      painel.style.display = "block";
    }

    // Validar e exibir elementos estruturais internos de forma segura
    const painelCorpo = document.getElementById("painel-corpo");
    if (painelCorpo) painelCorpo.style.display = "block";

    const btnFechar = document.querySelector(".btn-fechar-painel");
    if (btnFechar) btnFechar.style.display = "block";

    const detalhesMongo = document.getElementById("detalhes-mongo");
    if (detalhesMongo) detalhesMongo.style.display = "none";

    const avisoClique = document.getElementById("aviso-clique");
    if (avisoClique) avisoClique.style.display = "block";

    const zonaAlternar = document.getElementById("zona-alternar");
    if (zonaAlternar) zonaAlternar.style.display = "none";

    // Injetar dados protegidos contra valores nulos
    const infoName = document.getElementById("info-name");
    if (infoName) infoName.textContent = nomeTrilhoAtual;

    const infoDist = document.getElementById("info-dist");
    if (infoDist) {
      const distValor =
        data.properties?.distancia || data.properties?.distancia_km || "0";
      infoDist.textContent = distValor + " km";
    }

    const infoDiff = document.getElementById("info-diff");
    if (infoDiff) infoDiff.textContent = data.properties?.dificuldade || "n/a";

    // Injetar descrição curta
    const campoDescCurta = document.getElementById("info-desc-curta");
    if (campoDescCurta) {
      campoDescCurta.style.display = "block";
      campoDescCurta.textContent = descCurtaGuardada;
    }

    // Desenhar a linha no mapa
    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON && layer !== window.camadaPois)
        map.removeLayer(layer);
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
    console.error("Erro ao carregar percurso:", err);
  }
}

// Expande o painel e injeta a descrição longa (MongoDB)
async function mostrarDetalhesNoPainel(id) {
  const painel = document.getElementById("trail-info-panel");
  const zonaMongo = document.getElementById("detalhes-mongo");
  const descLongaArea = document.getElementById("info-desc-longa");
  const campoDescCurta = document.getElementById("info-desc-curta");
  const zonaAlternar = document.getElementById("zona-alternar");
  const btnAlternar = document.getElementById("btn-alternar-desc");

  // Elementos do Carrossel
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

    // Configurar o botão de alternar
    if (zonaAlternar) zonaAlternar.style.display = "block";
    if (btnAlternar)
      btnAlternar.textContent = "← Voltar para a descrição curta";
    exibindoLonga = true;

    if (campoDescCurta) campoDescCurta.style.display = "none";
    if (zonaMongo) zonaMongo.style.display = "block";

    // --- LÓGICA DO CARROSSEL DE IMAGENS ---
    // data.imagens corresponde ao campo Array que mostraste na primeira imagem do Atlas
    if (data.imagens && data.imagens.length > 0) {
      listaImagensGuardadas = data.imagens;
      indiceImagemAtual = 0;

      if (imgExibida) imgExibida.src = listaImagensGuardadas[indiceImagemAtual];
      if (zonaCarrossel) zonaCarrossel.style.display = "block";

      atualizarContadorCarrossel();
    } else {
      if (zonaCarrossel) zonaCarrossel.style.display = "none"; // Esconde se não houver fotos
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

    const infoName = document.getElementById("info-name");
    if (infoName) infoName.textContent = nomeTrilhoAtual;
  } catch (err) {
    console.error("Erro ao carregar dados do Mongo:", err);
  }
}

function mudarImagemCarrossel(direcao, event) {
  if (event) event.stopPropagation(); // Evita conflitos com cliques no painel

  if (listaImagensGuardadas.length === 0) return;

  indiceImagemAtual += direcao;

  // Se passar do fim, volta à primeira foto
  if (indiceImagemAtual >= listaImagensGuardadas.length) {
    indiceImagemAtual = 0;
  }
  // Se recuar antes da primeira, vai para a última foto
  if (indiceImagemAtual < 0) {
    indiceImagemAtual = listaImagensGuardadas.length - 1;
  }

  const imgExibida = document.getElementById("imagem-exibida");
  if (imgExibida) {
    imgExibida.style.opacity = "0.3"; // Pequeno efeito suave de transição
    setTimeout(() => {
      imgExibida.src = listaImagensGuardadas[indiceImagemAtual];
      imgExibida.style.opacity = "1";
    }, 150);
  }

  atualizarContadorCarrossel();
}

// Atualiza o pequeno texto "1 de 3"
function atualizarContadorCarrossel() {
  const contador = document.getElementById("contador-imagens");
  if (contador) {
    contador.textContent = `${indiceImagemAtual + 1} de ${listaImagensGuardadas.length}`;
  }
}

// Permite ao utilizador saltar entre a curta e a longa
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

// --- 6. FUNÇÕES DE MINIMIZAR E REABRIR A BARRA ---

function minimizarPainel(event) {
  if (event) event.stopPropagation();
  const painel = document.getElementById("trail-info-panel");
  const titulo = document.getElementById("info-name");
  if (!painel || !titulo) return;

  if (painel.classList.contains("expandido")) {
    titulo.textContent = `${nomeTrilhoAtual} (Detalhado)`;
  } else {
    titulo.textContent = nomeTrilhoAtual;
  }

  painel.classList.add("minimizado");
}

function reabrirPeloHeader() {
  const painel = document.getElementById("trail-info-panel");
  if (!painel) return;

  if (painel.classList.contains("minimizado")) {
    painel.classList.remove("minimizado");

    const painelCorpo = document.getElementById("painel-corpo");
    if (painelCorpo) painelCorpo.style.display = "block";

    const btnFechar = document.querySelector(".btn-fechar-painel");
    if (btnFechar) btnFechar.style.display = "block";

    const infoName = document.getElementById("info-name");
    if (infoName) infoName.textContent = nomeTrilhoAtual;
  }
}

// --- 7. EVENTOS E INICIALIZAÇÃO ---
const filtroDificuldade = document.getElementById("difficulty-filter");
if (filtroDificuldade) {
  filtroDificuldade.addEventListener("change", (e) => {
    atualizarListaTrilhos(e.target.value);
  });
}

// Quando escolhes o Trilho na lista
const seletorTrilhoClick = document.getElementById("trail-selector");
if (seletorTrilhoClick) {
  seletorTrilhoClick.addEventListener("change", (e) => {
    carregarTrilho(e.target.value);
  });
}

// Executa imediatamente ao abrir a página para carregar "Todos os Trilhos"
atualizarListaTrilhos("todos");

window.addEventListener("load", () => {
  setTimeout(() => {
    if (typeof map !== "undefined") map.invalidateSize();
  }, 500);
});

window.alternarDescricao = alternarDescricao;
