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
- Aplicação HTTP real: resposta de `/health`, UUID de requisição e cabeçalhos Helmet.
- Limite de corpo JSON: exatamente 256 KiB é parseado; corpos maiores recebem `413 Payload Too Large`.

Os testes HTTP sobem a aplicação em uma porta efêmera local. Em ambientes isolados, a execução precisa permitir bind de loopback.

O adapter usa um fake na suíte padrão para manter `npm test` independente de infraestrutura. Para exercitar BullMQ de verdade, suba o Redis local e rode `npm run test:redis`.

```bash
docker compose up -d redis
npm run test:redis
docker compose down
```

## Limites conhecidos

Ainda não há rota de ingestão, então os testes do envelope usam o mesmo `ValidationPipe` usado no bootstrap. Quando a rota de eventos for criada, adicionar testes HTTP para o contrato, autenticação, idempotência e indisponibilidade da fila.

Ainda não há cobertura de workers ou processamento de domínio porque esses componentes ainda não existem. Os testes não estabelecem um benchmark de throughput; performance será medida quando o pipeline estiver implementado.
