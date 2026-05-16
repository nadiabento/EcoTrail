// 1. CONFIGURAÇÃO DE CAMADAS DO MAPA
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
});

const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Tiles &copy; Esri" },
);

// 2. ÍCONES PARA POIS
const baseIconParams = {
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  shadowSize: [41, 41],
};

const iconesPorTipo = {
  // --- VERDES (Natureza e Caminhos) ---
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

  // --- AZUIS (Água e Engenharia) ---
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

  // --- LARANJA/AMARELO (Vistas e Informação) ---
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

  // --- VIOLETA/VERMELHO (História e Destaques) ---
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

  // --- CINZA (Infraestrutura) ---
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

// 3. INICIALIZAÇÃO DO MAPA
const map = L.map("map", {
  center: [40.6443, -8.6455],
  zoom: 11,
  layers: [osm],
});

L.control.layers({ "🗺️ Rua": osm, "🛰️ Satélite": satellite }).addTo(map);

// Referências DOM
const difficultyFilter = document.getElementById("difficulty-filter");
const trailSelector = document.getElementById("trail-selector");
const infoPanel = document.getElementById("trail-info-panel");

// 4. FUNÇÕES DE CARREGAMENTO

/**
 * FUNÇÃO: Atualiza o seletor de trilhos conforme a dificuldade escolhida
 */
async function atualizarListaTrilhos(dificuldade) {
  try {
    const response = await fetch(`/api/trilhos/${dificuldade}`);
    const trilhos = await response.json();
    trailSelector.innerHTML =
      '<option value="">-- Selecione um trilho --</option>';
    trilhos.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.nome;
      trailSelector.appendChild(opt);
    });
  } catch (err) {
    console.error("Erro ao atualizar lista:", err);
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

// FUNÇÃO PRINCIPAL: Carrega o trilho e prepara a janela esquerda
async function carregarTrilho(id) {
  if (!id) {
    infoPanel.style.display = "none";
    return;
  }

  try {
    const response = await fetch(`/api/trilho-completo/${id}`);
    const data = await response.json();

    // 1. Limpar linhas antigas do mapa
    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON && layer !== window.camadaPois) {
        map.removeLayer(layer);
      }
    });

    // 2. Desenhar a linha do trilho
    const camada = L.geoJSON(data, {
      style: { color: "#2ecc71", weight: 6, opacity: 0.8, cursor: "pointer" },
      onEachFeature: (feature, layer) => {
        layer.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          mostrarDetalhesNoPainel(id);
        });
      },
    }).addTo(map);

    map.fitBounds(camada.getBounds(), { padding: [50, 50] });

    // 3. RESET DO PAINEL (Garante que a curta volta a aparecer se mudares de trilho)
    infoPanel.classList.remove("expandido");
    infoPanel.style.display = "block";
    document.getElementById("detalhes-mongo").style.display = "none";
    document.getElementById("aviso-clique").style.display = "block";

    // GARANTE QUE A CURTA FICA VISÍVEL NO INÍCIO
    const campoDescCurta = document.getElementById("info-desc-curta");
    if (campoDescCurta) campoDescCurta.style.display = "block";

    // 4. Injetar dados do Postgres
    document.getElementById("info-name").textContent = data.properties.nome;
    document.getElementById("info-dist").textContent =
      data.properties.distancia + " km";
    document.getElementById("info-diff").textContent =
      data.properties.dificuldade;

    // 5. Injetar a descrição curta vinda do MongoDB Atlas
    const detalhes = data.properties.detalhes;
    if (campoDescCurta) {
      campoDescCurta.textContent =
        detalhes?.descricao_curta || "Sem descrição curta disponível.";
    }

    carregarPOIs(id);
  } catch (err) {
    console.error("Erro ao carregar trilho:", err);
  }
}

// FUNÇÃO PARA EXPANDIR E MOSTRAR DADOS DO MONGO
async function mostrarDetalhesNoPainel(id) {
  const painel = document.getElementById("trail-info-panel");
  const zonaMongo = document.getElementById("detalhes-mongo");
  const descLongaArea = document.getElementById("info-desc-longa");
  const campoDescCurta = document.getElementById("info-desc-curta");

  try {
    const res = await fetch(`/api/detalhes-mongo/${id}`);
    const data = await res.json();

    // 1. Expandir o painel e esconder o aviso
    painel.classList.add("expandido");
    document.getElementById("aviso-clique").style.display = "none";

    // --- A MAGIA ESTÁ AQUI: Esconde a descrição curta para dar lugar à longa ---
    if (campoDescCurta) campoDescCurta.style.display = "none";

    zonaMongo.style.display = "block";

    // 2. Preencher apenas com a descrição LONGA, fauna e flora
    descLongaArea.innerHTML = `
      <div style="animation: fadeIn 0.5s ease; margin-top: 10px;">
        <p style="line-height:1.6; color:#333; text-align:justify; font-size: 0.95em;">
          ${data.descricao_longa || "Não existe uma descrição detalhada disponível."}
        </p>
        <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
        <p>🌿 <b>Flora:</b> ${data.flora && data.flora.length > 0 ? data.flora.join(", ") : "n/a"}</p>
        <p>🦆 <b>Fauna:</b> ${data.fauna && data.fauna.length > 0 ? data.fauna.join(", ") : "n/a"}</p>
        <p>📅 <b>Melhor Época:</b> ${data.melhor_epoca || "n/a"}</p>
      </div>
    `;
  } catch (err) {
    console.error("Erro ao carregar descrição longa:", err);
  }
}

// 5. EVENTOS E INICIALIZAÇÃO
difficultyFilter.addEventListener("change", (e) =>
  atualizarListaTrilhos(e.target.value),
);
trailSelector.addEventListener("change", (e) => carregarTrilho(e.target.value));

function fecharPainel() {
  infoPanel.style.display = "none";
}

atualizarListaTrilhos("todos");

window.addEventListener("load", () => {
  setTimeout(() => map.invalidateSize(), 500);
});
