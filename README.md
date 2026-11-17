# High-Throughput Event-Driven Engine

Um projeto incremental de um motor de processamento de eventos com NestJS e TypeScript. O foco é demonstrar decisões de engenharia para resiliência, segurança, observabilidade e processamento assíncrono.

## Estado atual

A base da API inclui bootstrap NestJS, endpoint `/health`, cabeçalhos Helmet, proteção HPP, validação global estrita e CORS por allowlist configurável. A configuração é validada antes de abrir a porta e os valores de `.env` são carregados na inicialização. Ainda não há fila, Redis, persistência ou rate limiting; essas capacidades entram em etapas posteriores, com decisões e limites documentados junto ao código.

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
| `NODE_ENV` | `development`, `test` ou `production` | `development` |
| `PORT` | Porta HTTP (inteiro de 1 a 65535) | `3000` |
| `CORS_ORIGINS` | Origens HTTP(S) exatas, separadas por vírgula e sem caminho | vazio |

Se `CORS_ORIGINS` estiver vazio, CORS fica desativado. Valores inválidos interrompem a inicialização com uma mensagem estruturada. Em produção, configure somente origens confiáveis.

## Plano do projeto

As etapas e notas de implementação ficam em `tmp/roteiro.md`, que é ignorado pelo Git conforme solicitado. O README contém apenas o estado e as instruções necessárias para quem clonar o projeto.
