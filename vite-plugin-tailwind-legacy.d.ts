declare module "vite-plugin-tailwind-legacy" {
  import { Plugin } from "vite";

  export interface TailwindLegacyOptions {
    /**
     * Diretório de build do projeto.
     * @default "dist"
     */
    buildDir?: string;

    /**
     * Diretório onde os assets CSS/JS serão salvos.
     * @default "dist/client/assets"
     */
    assetsDir?: string;

    /**
     * Caminho público para servir os assets gerados.
     * @default "/static/assets/"
     */
    publicPath?: string;

    /**
     * Se deve injetar automaticamente o script de detecção nos arquivos HTML.
     * @default true
     */
    injectInHTML?: boolean;

    /**
     * Padrões de nomes de arquivos CSS modernos para remover em navegadores antigos.
     * Exemplo: ['layouts_tailwind*.css', 'grapesjs*.css']
     * @default []
     */
    deleteStyles?: string[];

    /**
     * Nome do arquivo CSS legável gerado.
     * @default "tailwind-v3-legacy.css"
     */
    outputCSSName?: string;

    /**
     * Nome do script JS de detecção de navegador.
     * @default "browser-check.js"
     */
    browserScriptName?: string;

    /**
     * Formato de cor para conversão de OKLCH.
     * @default "rgb"
     */
    colorFormat?: 'rgb' | 'hsl';

    /**
     * Lista de navegadores suportados (sintaxe Browserslist).
     * @default ["Chrome >= 90", "Opera >= 76", "Edge >= 90", "Firefox >= 88", "Safari >= 14"]
     */
    browsers?: string[];
  }

  /**
   * Plugin do Vite para suporte do Tailwind CSS v4 em navegadores antigos.
   * Converte OKLCH, color-mix, transforms, seletores escuros e nesting para CSS legado.
   */
  export default function TailwindLegacyPlugin(
    options?: TailwindLegacyOptions
  ): Plugin;
}