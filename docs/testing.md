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
- Aplicação HTTP real: resposta de `/health`, UUID de requisição e cabeçalhos Helmet.

Os testes HTTP sobem a aplicação em uma porta efêmera local. Em ambientes isolados, a execução precisa permitir bind de loopback.

## Limites conhecidos

Ainda não há rota de ingestão, então os testes de DTO usam um DTO representativo diretamente com o mesmo `ValidationPipe` usado no bootstrap. Quando a rota de eventos for criada, adicionar testes para contrato, payload excessivo, autenticação, idempotência e indisponibilidade da fila.

Não há cobertura de Redis, workers ou persistência porque esses componentes ainda não existem. Os testes não estabelecem um benchmark de throughput; performance será medida quando o pipeline estiver implementado.
