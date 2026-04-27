// 1. CONFIGURAÇÃO DE CAMADAS DO MAPA
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
});

const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Tiles &copy; Esri",
  },
);

// Inicialização do Mapa Leaflet
const map = L.map("map", {
  center: [40.6443, -8.6455],
  zoom: 11,
  layers: [osm], // Camada inicial
});

// Adiciona o seletor de camadas no topo direito
L.control.layers({ "🗺️ Rua": osm, "🛰️ Satélite": satellite }).addTo(map);

// Referências aos elementos do DOM (HTML)
const difficultyFilter = document.getElementById("difficulty-filter");
const trailSelector = document.getElementById("trail-selector");
const infoPanel = document.getElementById("trail-info-panel");
const btnReopen = document.getElementById("btn-reopen");

/**
 * FUNÇÃO: Atualiza o seletor de trilhos conforme a dificuldade escolhida
 */
async function atualizarListaTrilhos(dificuldade) {
  try {
    const response = await fetch(`/api/trilhos/${dificuldade}`);
    const trilhos = await response.json();

    // Limpa e reseta o seletor de trilhos
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

// --- FUNÇÃO PARA CARREGAR OS PONTOS DE INTERESSE ---
async function carregarPOIs(trilhoId) {
  try {
    console.log(`A carregar pontos de interesse para o trilho ${trilhoId}...`);
    const response = await fetch(`/api/pois/${trilhoId}`);
    const data = await response.json();

    // 1. Limpar POIs antigos se existirem
    if (window.camadaPois) {
      map.removeLayer(window.camadaPois);
    }

    // 2. Criar a nova camada de pontos
    window.camadaPois = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        return L.marker(latlng, { icon: poiIcon });
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`
                    <div style="text-align:center;">
                        <b style="color:#2ecc71;">📍 ${feature.properties.nome}</b><br>
                        <small>Tipo: ${feature.properties.tipo}</small>
                    </div>
                `);
      },
    }).addTo(map);
  } catch (err) {
    console.error("Erro ao carregar POIs:", err);
  }
}

// --- FUNÇÃO PARA CARREGAR O TRILHO ---
async function carregarTrilho(id) {
  if (!id) {
    infoPanel.style.display = "none";
    return;
  }

  try {
    const response = await fetch(`/api/trilho-completo/${id}`);
    const data = await response.json();

    // 1. Limpar linhas antigas
    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON && layer !== window.camadaPois) {
        map.removeLayer(layer);
      }
    });

    // 2. Desenhar a linha do trilho
    const camada = L.geoJSON(data, {
      style: { color: "#2ecc71", weight: 6, opacity: 0.8 },
    }).addTo(map);

    // 3. Ajustar zoom
    map.fitBounds(camada.getBounds(), { padding: [50, 50] });

    // 4. Mostrar painel de info
    infoPanel.style.display = "block";
    document.getElementById("info-name").textContent = data.properties.nome;
    document.getElementById("info-dist").textContent =
      data.properties.distancia;
    document.getElementById("info-diff").textContent =
      data.properties.dificuldade;
    document.getElementById("info-desc").textContent =
      data.properties.detalhes.descricao;

    // --- CHAMADA DOS POIS ---
    // Agora que o trilho carregou, vamos buscar os pontos que a Jéssica fez
    carregarPOIs(id);
  } catch (err) {
    console.error("Erro ao carregar trilho:", err);
  }
}

// --- EVENTOS ---

// Quando muda a dificuldade, recarrega a lista
difficultyFilter.addEventListener("change", (e) => {
  atualizarListaTrilhos(e.target.value);
});

// Quando seleciona um trilho, carrega os dados
trailSelector.addEventListener("change", (e) => {
  carregarTrilho(e.target.value);
});

// NOVO: Evento para o botão "i" - Reabre a janela se o utilizador a fechou
btnReopen.addEventListener("click", () => {
  const selectedId = trailSelector.value;
  if (selectedId) {
    carregarTrilho(selectedId); // Re-executa a função para abrir a janela
  } else {
    alert("Selecione primeiro um trilho na lista!");
  }
});

// Inicialização: Preenche a lista com "todos" ao carregar a página
atualizarListaTrilhos("todos");

const poiIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png", // Podes mudar para um ícone de GPS
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Correção para redimensionamento do mapa
window.addEventListener("load", () => {
  setTimeout(() => map.invalidateSize(), 500);
});
