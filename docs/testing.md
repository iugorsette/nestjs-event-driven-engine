# Testes e validação local

## Executar

```bash
npm test
npm run build
npm run lint
```

`npm test` usa o test runner que já vem com Node.js e compila os arquivos TypeScript de teste para `dist-test/`, pasta ignorada pelo Git. Não é necessário instalar um framework de testes separado.

## Cobertura atual

- Configuração: valores padrão, ambiente inválido, limites da porta e origens CORS fora do formato permitido.
- Validação de DTO: transformação para a classe, rejeição de campos não permitidos e tipos inválidos.
- Contrato de eventos: envelope válido, campos desconhecidos, versão e timestamp inválidos, fingerprint, duplicatas/conflitos e resultado do caso de uso.
- Adapter BullMQ: job ID determinístico, colisão concorrente, fingerprint conflitante e falha de Redis.
- Rota `POST /events` com storage fake: aceitação, duplicata, conflito `409`, chave ausente/inválida, campo extra, fila indisponível (`503`), storage do limitador indisponível (`503`) e limite excedido (`429`).
- Aplicação HTTP real: resposta de `/health`, UUID de requisição e cabeçalhos Helmet.
- Limite de corpo JSON: exatamente 256 KiB é parseado; corpos maiores recebem `413 Payload Too Large`.

Os testes HTTP sobem a aplicação em uma porta efêmera local. Em ambientes isolados, a execução precisa permitir bind de loopback.

O adapter usa um fake na suíte padrão para manter `npm test` independente de infraestrutura. A suíte de integração usa Redis real para confirmar uma requisição HTTP na fila, duplicata, conflito e `429` com `Retry-After`, além de repetir o cenário básico de persistência/idempotência do adapter BullMQ.

Para executá-la, suba o Redis local e rode `npm run test:redis`.

```bash
docker compose up -d redis
npm run test:redis
docker compose down
```

## Limites conhecidos

Os testes HTTP abrem a aplicação em uma porta efêmera de loopback; em ambientes isolados, a execução precisa permitir bind local. A suíte de integração requer também o Redis do Compose. A falha do storage do limitador é coberta em HTTP por um fake determinístico; ainda falta reproduzir indisponibilidade real do Redis nesse cenário.

Ainda faltam testes diretos de expiração e concorrência do script Lua sob Redis real. A suíte não cobre rotação de credenciais nem a política de IP atrás do proxy de produção. O handler do worker é demonstrativo, sem persistência de domínio. A suíte não estabelece benchmark de throughput; performance será medida quando o processamento real estiver implementado.

O script Lua é copiado para `dist` pelo Nest CLI. A cobertura de integração atual confirma o limite `429` e `Retry-After`; build e lint sozinhos não validam a semântica do script.
