# Site público da barbearia

Frontend público extraído do HL Gestão, com a homepage anterior recuperada do histórico. O projeto original permanece intacto.

Inclui perfil da empresa, serviços, profissionais, assinaturas, produtos, localização, horários, contato, agendamento e área do cliente. Os serviços e modelos compartilhados necessários foram copiados; não há dependência de arquivos do projeto original.

## Executar

Requer Node.js compatível com Angular 20 (20.19+ ou 22.12+) e npm.

```bash
npm ci
npm start
```

Abra http://localhost:4200/buscar para encontrar uma empresa ou http://localhost:4200/SLUG-DA-EMPRESA para acessar o site dela. A raiz direciona à busca. O slug é o cadastrado no HL Gestão.

## API e dados

Este é um frontend independente, conectado ao backend do HL Gestão. Não inclui banco de dados, backend ou credenciais. Para visualizar dados reais e usar agendamento, login e contratação, mantenha a API em execução.

No desenvolvimento, `proxy.conf.json` encaminha `/api` para http://localhost:5126 (porta padrão do backend local). Altere o destino se sua API estiver em outra porta ou servidor.

Em produção, configure `apiBaseUrl` em `src/environments/environment.production.ts` ou use um proxy reverso para `/api`. Se usar domínios distintos, configure CORS, cookies e URLs de retorno do backend para o domínio do site. O servidor de hospedagem deve direcionar rotas do frontend para `index.html`.

## Build

```bash
npm run build:production
```

Saída: `dist/hl-gestao/browser`. As configurações de ambientes existentes foram preservadas e devem ser revisadas antes de publicar.

A homepage é exibida em `/<slug-da-empresa>`. Ela foi recuperada do histórico do projeto e suas imagens e dados dependem da API configurada.

## Apresentação sem empresa

Acesse http://localhost:4200/ para abrir a homepage ilustrativa, sem API ou slug. Serviços, preços e plano são exemplos configurados em `src/app/presentation-home.component.ts`. As fotos ilustrativas ficam em `public/assets/fotos/apresentacao`.
