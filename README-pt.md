# vite-plugin-tailwind-legacy

⚡ Plugin Vite que gera CSS do Tailwind v4 com compatibilidade para navegadores antigos como fallback, usando Tailwind CSS v3.

### ✨ Por que usar?
Problema:

❌ Tailwind v4 usa recursos CSS modernos como `oklch()` que quebram em navegadores antigos

❌ Polyfills convencionais não resolvem completamente o problema

❌ Manter duas versões do CSS manualmente é trabalhoso

Solução:

✅ Gera automaticamente um fallback em Tailwind v3 para navegadores legados

✅ ZERO impacto no Tailwind v4 para navegadores

✅ Apenas dispositivos legados que receberam um novo css

### 🎬 para ver as demonstrações veja as imagens lá em baixo 👇

O objetivo do plugin é manter a experiência consistente em navegadores legados sem comprometer  vantagens do Tailwind v4 (para navegadores modernos). Com um desenvolvimento atento às duas realidades, seu site terá aparência e funcionalidade muito próximas em qualquer navegador - moderno ou antigo - enquanto você continua aproveitando todos os recursos avançados da v4 em seu fluxo de trabalho.

# ✨ Funcionalidades

Este plugin executa uma etapa extra após o build para:

- Gerar um CSS legado com `tailwindcss@3` compatível com navegadores antigos

- Injetar dinamicamente o CSS legado em navegadores que não suportam Tailwind v4 (como Chrome < 111) pormeio de um script `browser-check.js` nos HTMLs da build


## 🚀 Instalação

```bash
npm install --save-dev vite-plugin-tailwind-legacy
# ou
yarn add vite-plugin-tailwind-legacy --dev
```

## ⚙️ Configuração

- Adicione o plugin  `vite-plugin-tailwind-legacy` nas configs do vite.

```javascript
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import TailwindLegacyPlugin from 'vite-plugin-tailwind-legacy'; 



export default defineConfig(({ command }) => {
  const isBuild = command === 'build';

   return {
      plugins: [
        react(),
        tailwindcss(),
        TailwindLegacyPlugin({
          tailwindConfig: 'tailwind.config.legacy.js',
          assetsDir: 'dist/assets',
          publicPath: '/static/assets/',
          injectInHTML: true,
        })
      ],      
}
})
````


## 🛠 Informaçãos relevantes


⚠️ **Atenção especial** - Antes de seguir atente-se a essas duas informações importantes:

1 - O campo `content` - ele deve apontar para a build final do vite:

```javascript
content: ["./dist/**/*.{html,js}"],  // 👈 Verifique se este path corresponde aos seus arquivos buildados pelo vite
```

2 - Cores

O Tailwind v4 utiliza `oklch()` como formato padrão de cores, que não funcionam em navegadores mais antigos. Para garantir o funcionamento:

- Use cores hexadecimais (`#RRGGBB`) em seu tema
- Converta valores `oklch` (https://oklch.com)

Exemplo básico:
```javascript
colors: {
  primary: '#1445e2',       // Formato compatível
  secondary: '#4f46e5'      // Formato compatível
}
````
## ⚙️ Configuração do Tailwind (Versão Legacy)
📁 Crie um arquivo `tailwind.config.legacy.js` no mesmo diretorio do `vite.config.ts` com esta estrutura base (Altere as cores pro seu tema):
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/**/*.{html,js}"],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        background: '#fefeff',
        foreground: '#333333',
        card: '#ffffff',
        "card-foreground": '#333333',
        popover: '#ffffff',
        "popover-foreground": '#333333',
        primary: '#1445e2',
        "primary-foreground": '#f9f9f9',
        secondary: '#0598f6',
        "secondary-foreground": '#f9f9f9',
        muted: '#f0f0ff',
        "muted-foreground": '#7a7a99',
        accent: '#b76b2c',
        "accent-foreground": '#ffffff',
        destructive: '#e74c3c',
        "destructive-foreground": '#fff2f2',
        border: '#e0e0f0',
        input: '#e0e0f0',
        ring: '#333333',
        chart: {
          1: '#c96d3f',
          2: '#47c1a9',
          3: '#4297e7',
          4: '#8a64d1',
          5: '#df5d8f',
        },
        base: {
          100: '#fefeff',
          200: '#f0f0ff',
          300: '#e3e3ff',
          content: '#333333',
        },
        
        chart: {
          1: '#c96d3f',
          2: '#47c1a9',
          3: '#4297e7',
          4: '#8a64d1',
          5: '#df5d8f',
        },

        
       neutral: '#6b6b8d',
        "neutral-content": '#fefeff',
        info: '#5bbef0',
        "info-content": '#f6faff',
        success: '#63d182',
        "success-content": '#f0fff5',
        warning: '#f6d365',
        "warning-content": '#fff9e3',
        error: '#e74c3c',
        "error-content": '#fff2f2',
        
        sidebar: '#fbfbff',
        "sidebar-foreground": '#252525',
        "sidebar-primary": '#252525',
        "sidebar-primary-foreground": '#fbfbff',
        "sidebar-accent": '#f0f0ff',
        "sidebar-accent-foreground": '#252525',
        "sidebar-border": '#e8e8e8',
        "sidebar-ring": '#737373',
        
      },


      borderRadius: {
        sm: 'calc(0.625rem - 4px)',
        md: 'calc(0.625rem - 2px)',
        lg: '0.625rem',
        xl: 'calc(0.625rem + 4px)',
      },


      height: {
           ...Array.from({ length: 1000 }, (_, i) => i + 1).reduce((acc, val) => {
          acc[val] = `${val * 0.25}rem`;
          return acc;
        }, {}),
      },
      width: {
           ...Array.from({ length: 1000 }, (_, i) => i + 1).reduce((acc, val) => {
          acc[val] = `${val * 0.25}rem`;
          return acc;
        }, {}),
      },
      padding: {
        ...Array.from({ length: 1000 }, (_, i) => i + 1).reduce((acc, val) => {
          acc[val] = `${val * 0.25}rem`;
          return acc;
        }, {}),
      },
      margin: {
        ...Array.from({ length: 1000 }, (_, i) => i + 1).reduce((acc, val) => {
          acc[val] = `${val * 0.25}rem`;
          return acc;
        }, {}),
      },
      gap: {
           ...Array.from({ length: 1000 }, (_, i) => i + 1).reduce((acc, val) => {
          acc[val] = `${val * 0.25}rem`;
          return acc;
        }, {}),
      },
      zIndex: {
        ...Array.from({ length: 1000 }, (_, i) => i + 1).reduce((acc, val) => {
          acc[val] = `${val}`;
          return acc;
        }, {}),
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'), // Se você não usa você deve remover
    function({ addBase }) {
          addBase({
            'button': {
              backgroundColor: 'transparent',
              backgroundImage: 'none',
              padding: 0,
              border: 'none',
              outline: 'none',
              cursor: 'pointer',
            },
          });
        },
  ],
};
```

## 📝 Como Usar
1- Instale o plugin como mostrado acima

2 - Configure o Vite config conforme o exemplo

3 - Crie o arquivo de configuração do Tailwind

4 - Execute seu build do vite normalmente [pode ser que peça atorização para instalar o tailwind-v3 [ela não deve inteferir com o projeto pois não vai instalar no `package.json` do seu projeto)]

__________________________________________________________

__________________________________________________________

## 🛠 Configurações específicas

Configs padrão:
```javascript
TailwindLegacyPlugin({
  tailwindConfig: 'tailwind.config.legacy.js', // Trocar o diretorio do tailwindConfig
  inputCSS: 'input.css', // Trocar o nome do arquivo CSS de entrada
  assetsDir: 'dist/assets', // Trocar o diretorio de saída dos arquivos gerados
  publicPath: '/static/assets/',  // Trocar o public path
  buildDir: 'dist', // Trocar o diretório de saída da build para escanear arquivos HTML
  injectInHTML: true,   // Ativa inserção do script de verificação de navegador antigo
  injectInHTML: true,   // Ativa inserção do script de verificação de navegador antigo
  deleteStyles: ['app', 'layout'],  // Seleciona qual stylesheet sera deletado, se vazio deleta todos
  outputCSSName: 'tailwind-v3-legacy.css', // Altera o nome do arquivo css gerado, deve terminar com .css
})
```
#### 📂 tailwindConfig

Padrão: `'tailwind.config.legacy.js'`

O que faz: Especifica o caminho para o arquivo de configuração do Tailwind v3

Quando alterar: Se você quiser usar um nome diferente para o arquivo de configuração ou diretorio

Exemplo:
```javascript
tailwindConfig: './config/tailwind-legacy-config.js'
```

#### 📁 assetsDir

Padrão: 'dist/assets'

O que faz: Define onde os arquivos CSS e JS gerados serão salvos
Quando alterar: Se sua build usa uma estrutura de diretórios diferente

Exemplo:
```javascript
assetsDir: 'build/static'
````

#### 📄 inputCSS

Padrão: `'input.css'`

O que faz: Especifica o nome do arquivo CSS temporário que será criado durante o processo de build

Quando alterar: Se você precisar evitar conflitos com arquivos existentes no seu projeto

Exemplo:
```javascript
inputCSS: 'legacy-input.css'
// ou
inputCSS: 'src/test/legacy-input.css'
```

#### 🌐 publicPath

Padrão: '/static/assets/'

O que faz: Controla o caminho público usado para carregar os assets no HTML

Quando alterar: Quando os assets são servidos de um path diferente

Exemplo:
Example:
```javascript
publicPath: '/static/' // caminho relativo
// or
publicPath: 'https://cdn.exemplo.com.br/assets/' // url completa
```

#### 📂 buildDir

Padrão: `'dist'`

O que faz: Especifica o diretório de saída da build onde os arquivos HTML estão localizados para injeção do script

Quando alterar: Quando usar frameworks diferentes (ex: Nuxt usa `.output/public`, Next.js usa `out`, etc.)

Exemplo:
```javascript
buildDir: '.output/public'  // Para Nuxt
// ou
buildDir: 'out'  // Para Next.js export estático
```

#### ✨ injectInHTML

Padrão: `true`

O que faz: Automaticamente injeta o script de verificação de navegador legado

Quando desativar (false): Em SSG (como Next.js, Gatsby), pode usar o backend Django, por exemplo, para verificar o navegador do cliente antes de servir o html evitando que inicie desconfigurado, pode ja injetar o `output.css` gerado pelo plugin.
Para implementações server-side (Django, Rails, etc), consulte:  

[BACKEND-INTEGRATION.md](./BACKEND-INTEGRATION.md)  
*(Inclui exemplos de detecção de navegador e fallback controlado)*


#### 🎯 deleteStyles

Padrão: `[]` (array vazio)

O que faz: Define quais arquivos CSS serão removidos em navegadores legados. Se vazio, remove TODOS os estilos. Se preenchido, remove apenas os especificados.

Quando usar: Quando você quer preservar alguns estilos (ex: CSS de componentes, estilos críticos) e só substituir o Tailwind.

Exemplo: 
```javascript
deleteStyles: ['app', 'layout'] //remove app.css, app-abc123.css, layout.css, layout-min.css, etc.
// ou 
deleteStyles: ['app.css', 'layout.css'] //remove app.css, layout.css, etc.
```

#### 📄 outputCSSName

Padrão: `'tailwind-v3-legacy.css'`

O que faz: Define o nome do arquivo CSS gerado pelo Tailwind v3 para navegadores legados.

Quando alterar: Para personalizar o nome do arquivo de fallback ou evitar conflitos.

Exemplo:
```javascript
outputCSSName: 'legacy-styles.css' // gera legacy-styles.css em vez do padrão.
```



## 🔄 Compatibilidade com Navegadores

🚨 Limitações em Navegadores Legados
**O recurso `gap` do Flexbox/Grid não tem suporte completo em:**
- Chrome < 84 (lançado em 2020)
- Firefox < 80 (lançado em 2020)
- Safari < 14.1 (lançado em 2021)
- Edge < 84 (lançado em 2020)

Você pode contornar isso usando outras classes css no seu projeto ja pensando que quer compatibilidade pra navegadores muito antigos.


## ❓Como funciona?

1 - O `vite-plugin-tailwind-legacy` cria um arquivo css baseado na v3 para navegadores antigos

2 - Adiciona um script aos html que verifica se é um navegador antigo, se for ele usa como fallback `output.css` para navegadores antigos.

### 🔄 Fluxo `vite-plugin-tailwind-legacy`

```mermaid
graph TD
    A[Navegador Acessa a Página] --> B[Carrega Tailwind v4 Padrão]
    B --> C{É Browser Legacy?}
    C -->|NÃO - Navegador Moderno| D[Não faz nada]
    C -->|SIM - Navegador Legado| E[Remover Tailwind v4 Dinamicamente]
    E --> F[Injetar CSS da Tailwind v3]

    style D fill:#005a1c,stroke:#166534
  style F fill:#005a1c,stroke:#166534
    style E fill:#c67000,stroke:#92400e
````


# 🔍 Exemplos

### Antes e depois do plugin Chrome 85.0.4183.102 pelo celular (só gerei o output.css e apliquei no site delo Developer Tools)

Shadcn https://ui.shadcn.com/docs/components/avatar
<div style="display: flex; flex-direction: column; gap: 16px;">
  <div style="display: flex; gap: 10px;">
    <img style="width: 44%; object-fit: contain;" src="https://raw.githubusercontent.com/sapiyans/vite-plugin-tailwind-legacy/refs/heads/main/exemplo/images/shadcn_antes.png" alt="antes" />
    <img style="width: 44%; object-fit: contain;" src="https://raw.githubusercontent.com/sapiyans/vite-plugin-tailwind-legacy/refs/heads/main/exemplo/images/shadcn_depois.png" alt="depois" />
  </div>
  <img style="width: 100%;" alt="gif demonstrativo" src="https://raw.githubusercontent.com/sapiyans/vite-plugin-tailwind-legacy/refs/heads/main/exemplo/images/shadcn_gif.gif" />
</div>

## Sites que estão em desenvolvimento com tailwind v4 =>

Antes e depois do plugin Chrome 85.0.4183.102 pelo celular
<div style="display: flex; gap: 10px;">
  <img style="width: 44%; object-fit: contain;" alt="antes" src="https://raw.githubusercontent.com/sapiyans/vite-plugin-tailwind-legacy/refs/heads/main/exemplo/images/clinica_antes.png" />
  <img style="width: 44%; object-fit: contain;" alt="Depois" src="https://raw.githubusercontent.com/sapiyans/vite-plugin-tailwind-legacy/refs/heads/main/exemplo/images/clinica_depois.png" />
</div>

## 📊 Performance

**Impacto zero** em navegadores modernos (nenhum CSS extra carregado)

**Impacto mínimo** em navegadores legados (apenas uma requisição HTTP adicional)

CSS gerado é automaticamente minificado