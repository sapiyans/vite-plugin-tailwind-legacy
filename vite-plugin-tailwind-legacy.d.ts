declare module 'vite-plugin-tailwind-legacy' {
  import { Plugin } from 'vite';
  
  interface TailwindLegacyOptions {
    tailwindConfig?: string;
    inputCSS?: string,
    assetsDir?: string;
    publicPath?: string;
    buildDir?: string;
    injectInHTML?: boolean;
    deleteStyles?: string[]; 
    outputCSSName?: string;
  }

  const TailwindLegacyPlugin: (options?: TailwindLegacyOptions) => Plugin;
  export default TailwindLegacyPlugin;
}
