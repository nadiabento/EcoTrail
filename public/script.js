/**
 * PROJETO ECOTRAIL - SCRIPT DE INTEGRAÇÃO (PESSOA 3)
 */

// 1. Inicializar o mapa (Aveiro por defeito)
const map = L.map("map").setView([40.6443, -8.6455], 13);

// 2. Adicionar a camada base (OpenStreetMap)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

/**
 * SOLUÇÃO PARA O BUG VISUAL (Tiles desalinhadas)
 * O comando invalidateSize força o Leaflet a recalcular as dimensões do contentor
 * assim que a janela termina de carregar completamente.
 */
window.addEventListener("load", () => {
  setTimeout(() => {
    map.invalidateSize();
  }, 300); // 300ms é o tempo de segurança para o CSS assentar
});

/**
 * FUNÇÃO: carregarTrilho
 * Faz a ponte entre o Frontend e a tua API híbrida (Node.js)
 */
async function carregarTrilho(id) {
  try {
    console.log(`A carregar trilho ID: ${id}...`);

    const response = await fetch(`/api/trilho-completo/${id}`);
    const data = await response.json();

    if (data.error) {
      console.error("Erro na API:", data.error);
      return;
    }

    // LIMPEZA: Remove trilhos anteriores para não sobrepor
    map.eachLayer((layer) => {
      // Se a camada for um GeoJSON (o trilho), removemos
      if (layer instanceof L.GeoJSON) {
        map.removeLayer(layer);
      }
    });

    // DESENHO: Adiciona o novo GeoJSON ao mapa
    const camadaTrilho = L.geoJSON(data, {
      style: {
        color: "#2ecc71", // Verde Eco
        weight: 6,
        opacity: 0.8,
      },
      onEachFeature: (feature, layer) => {
        // Aqui montamos o conteúdo usando dados do Postgres e MongoDB
        // feature.properties contém os dados do Postgres
        // feature.properties.detalhes contém os dados do MongoDB
        const props = feature.properties;
        const mongo = props.detalhes || {};

        const popupContent = `
                    <div class="map-popup">
                        <h3>${props.nome || "Trilho"}</h3>
                        <p><strong>Dificuldade:</strong> ${props.dificuldade || "N/A"}</p>
                        <p>${mongo.descricao || "Sem descrição disponível."}</p>
                        ${
                          mongo.fotos && mongo.fotos.length > 0
                            ? `<img src="${mongo.fotos[0]}" alt="Foto do trilho">`
                            : "<p><em>(Sem fotos)</em></p>"
                        }
                    </div>
                `;
        layer.bindPopup(popupContent);
      },
    }).addTo(map);

    // AJUSTE: Faz zoom automático para o trilho desenhado
    map.fitBounds(camadaTrilho.getBounds(), { padding: [30, 30] });
  } catch (err) {
    console.error("Erro na comunicação com o servidor:", err);
  }
}

// 3. EVENTO: Escutar mudanças no seletor de trilhos
document.getElementById("trail-selector").addEventListener("change", (e) => {
  const idSelecionado = e.target.value;
  carregarTrilho(idSelecionado);
});

// 4. INÍCIO: Carrega o primeiro trilho automaticamente ao abrir a página
carregarTrilho(1);
