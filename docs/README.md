# Documentação

Esta documentação explica o que o sistema faz hoje, por que as decisões foram tomadas e quais propriedades precisam ser preservadas quando novas features forem implementadas. O estado de cada item é explícito para separar código existente de proposta futura.

## Guias

- [Arquitetura e decisões técnicas](architecture.md): fluxo atual, limites e princípios de evolução.
- [Segurança](security.md): controles presentes, ameaças mitigadas e lacunas conhecidas.
- [Testes](testing.md): comandos disponíveis e o comportamento coberto pela suíte.
- [Roadmap](roadmap.md): etapas de desenvolvimento e critérios para considerar cada uma pronta.
- [Features](features/README.md): documentação funcional das capacidades atuais e planejadas.

## Como ler o estado das features

- **Implementado**: existe no código atual.
- **Planejado**: decisão ou objetivo documentado, ainda sem implementação.
- **Em aberto**: depende de requisitos, medições ou decisão arquitetural futura.

Os documentos devem ser atualizados junto com o código de cada etapa. Uma feature só deve ser marcada como implementada depois que o comportamento estiver presente e os limites relevantes estiverem registrados.
