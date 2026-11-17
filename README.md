# High-Throughput Event-Driven Engine

Um projeto incremental de um motor de processamento de eventos com NestJS e TypeScript. O foco é demonstrar decisões de engenharia para resiliência, segurança, observabilidade e processamento assíncrono.

## Estado atual

A primeira etapa cria a base executável da API: bootstrap NestJS, endpoint `/health`, cabeçalhos Helmet, proteção HPP, validação global estrita e CORS por allowlist configurável. Ainda não há fila, Redis, persistência ou rate limiting; essas capacidades entram em etapas posteriores, com decisões e limites documentados junto ao código.

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior

## Executar localmente

```bash
cp .env.example .env
npm install
npm run start:dev
```

Verifique `http://localhost:3000/health`; a resposta esperada é `{"status":"ok"}`.

## Configuração

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `NODE_ENV` | Ambiente de execução | `development` |
| `PORT` | Porta HTTP | `3000` |
| `CORS_ORIGINS` | Origens permitidas separadas por vírgula | `http://localhost:3001` no `.env.example` |

Se `CORS_ORIGINS` estiver vazio, CORS fica desativado. Em produção, configure somente origens confiáveis.

## Plano do projeto

As etapas e notas de implementação ficam em `tmp/roteiro.md`, que é ignorado pelo Git conforme solicitado. O README contém apenas o estado e as instruções necessárias para quem clonar o projeto.
