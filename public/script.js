// --- CONFIGURAÇÃO DO MAPA ---
// Cria as camadas de mapa (Street e Satélite)
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OSM",
});
const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "© Esri" },
);

// Inicializa o mapa focado em Aveiro
const map = L.map("map", {
  center: [40.6443, -8.6455],
  zoom: 11,
  layers: [osm],
});

// Adiciona o botão no canto superior direito para trocar o tipo de mapa
L.control.layers({ Rua: osm, Satélite: satellite }).addTo(map);

// Referências aos elementos HTML
const difficultyFilter = document.getElementById("difficulty-filter");
const trailSelector = document.getElementById("trail-selector");
const infoPanel = document.getElementById("trail-info-panel");

/** * FUNÇÃO: Atualiza a lista de nomes no dropdown quando mudamos a dificuldade
 */
async function atualizarLista(dificuldade) {
  const res = await fetch(`/api/trilhos/${dificuldade}`);
  const trilhos = await res.json();

  trailSelector.innerHTML = '<option value="">-- Escolha um Trilho --</option>';
  trilhos.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.nome;
    trailSelector.appendChild(opt);
  });
}

/** * FUNÇÃO: Desenha o trilho no mapa e abre o painel lateral
 */
async function carregarTrilho(id) {
  if (!id) return;
  const res = await fetch(`/api/trilho-completo/${id}`);
  const data = await res.json();

  // Limpa trilhos desenhados anteriormente para não amontoar
  map.eachLayer((l) => {
    if (l instanceof L.GeoJSON) map.removeLayer(l);
  });

  // Desenha a nova linha verde no mapa
  const camada = L.geoJSON(data, {
    style: { color: "#2ecc71", weight: 5 },
  }).addTo(map);

  // Faz zoom automático para o trilho selecionado
  map.fitBounds(camada.getBounds(), { padding: [50, 50] });

  // Preenche o painel lateral com os dados do Postgres + Mongo
  infoPanel.style.display = "block";
  document.getElementById("info-name").textContent = data.properties.nome;
  document.getElementById("info-dist").textContent = data.properties.distancia;
  document.getElementById("info-diff").textContent =
    data.properties.dificuldade;
  document.getElementById("info-desc").textContent =
    data.properties.detalhes.descricao;
}

// --- EVENTOS (Interação do Utilizador) ---
difficultyFilter.addEventListener("change", (e) =>
  atualizarLista(e.target.value),
);
trailSelector.addEventListener("change", (e) => carregarTrilho(e.target.value));

// Inicia a lista ao abrir a página
atualizarLista("todos");
