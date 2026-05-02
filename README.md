# 🚀 Projeto EcoTrail: Gestor de Trilhos Ecológicos

O EcoTrail é uma aplicação Full-Stack GIS que permite a visualização interativa de trilhos em Aveiro, integrando dados geográficos complexos com conteúdos multimédia ricos.

# 🏗️ Arquitetura do Sistema

O projeto utiliza uma arquitetura híbrida de bases de dados para otimizar o desempenho:

PostgreSQL + PostGIS (Neon.tech): Armazenamento de geometrias (LineStrings/Points) e metadados técnicos.

MongoDB Atlas: Armazenamento de dados não estruturados (descrições longas, fauna, flora e URLs de imagens).

Backend: Node.js com Express para orquestração e fusão de dados.

Frontend: Leaflet.js para renderização cartográfica.

Membro,Função,Foco Principal

Jessica: Gestor de Dados Espaciais,"SQL, PostGIS, Geometrias e Queries Espaciais."

António: Gestor de Conteúdo NoSQL,"MongoDB, Curadoria de Conteúdo e Imagens."

Nadia: Integrador & Frontend,"API Híbrida, Leaflet.js, UX/UI e Deploy."

# Configuração do Ambiente

1. Requisitos Prévios
   Node.js instalado.

Contas ativas no Neon.tech (Postgres) e MongoDB Atlas.

2. Instalação e Execução

# Instalar dependências

npm install

npm install express pg mongodb dotenv cors

# Iniciar o servidor

npm start

O servidor ficará disponível em http://localhost:3000.
