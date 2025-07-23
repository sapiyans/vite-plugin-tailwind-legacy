import fs from "fs";
import path from "path";
import { execSync } from "child_process";

/**
 * @param {{
 *  tailwindConfig?: string;
 *  inputCSS?: string;
 *  assetsDir?: string;
 *  publicPath?: string; // para uso no HTML (ex: "/static/assets/")
 *  injectInHTML = boolean;
 * }} options
 */
export default function TailwindLegacyPlugin(options = {}) {
  const {
    tailwindConfig = "tailwind.config.legacy.js",
    inputCSS = "input.css",
    assetsDir = "dist/assets",
    publicPath = "/static/assets/",
    injectInHTML = true,
  } = options;

  return {
    name: "vite:tailwind-legacy",

    async closeBundle() {
      console.log("⚙️ [Tailwind Legacy] Pós-build iniciado...");

      if (!fs.existsSync(tailwindConfig)) {
        console.error(`❌ Arquivo ${tailwindConfig} não encontrado`);
        return;
      }

      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
        console.log(`✅ Pasta ${assetsDir} criada`);
      }

      fs.writeFileSync(
        inputCSS,
        "@tailwind base;\n@tailwind components;\n@tailwind utilities;"
      );
      console.log("✅ input.css criado");

      try {
        execSync(
          `npx tailwindcss@3.4.1 -c ${tailwindConfig} -i ${inputCSS} -o ${path.join(assetsDir, "output.css")} --minify`,
          { stdio: "inherit" }
        );
        console.log("✅ CSS legado gerado");
      } catch (err) {
        console.error("❌ Erro ao gerar CSS legado", err.message);
        return;
      }

      const browserCheckScript = `
        const MIN_CHROME = 111;
        const MIN_SAFARI = 16.4;
        const MIN_FIREFOX = 128;

        function isLegacyBrowser() {
          const ua = navigator.userAgent;

          const chrome = ua.match(/Chrome\\/([0-9]+)/);
          if (chrome && parseInt(chrome[1]) < MIN_CHROME) return true;

          const safari = ua.match(/Version\\/([0-9.]+).*Safari/);
          if (safari && parseFloat(safari[1]) < MIN_SAFARI) return true;

          const firefox = ua.match(/Firefox\\/([0-9]+)/);
          if (firefox && parseInt(firefox[1]) < MIN_FIREFOX) return true;

          return false;
        }

        function checkBrowser() {
          if (isLegacyBrowser()) {
            document.querySelectorAll('link[rel="stylesheet"], style').forEach(el => el.remove());
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '${publicPath}output.css';
            document.head.appendChild(link);
          }
        }

        checkBrowser();
        document.addEventListener('DOMContentLoaded', checkBrowser);
      `.trim();

      const browserCheckPath = path.join(assetsDir, "browser-check.js");
      fs.writeFileSync(browserCheckPath, browserCheckScript);
      console.log("✅ browser-check.js criado");
      if (injectInHTML) {
        injectScript(path.join(process.cwd(), "dist"), publicPath);
        console.log("✅ browser-check.js injetado nos HTMLs");
      } else {
        console.log("ℹ️ Injeção nos HTMLs desativada (injectInHTML: false)");
      }
    },
  };
}

function injectScript(dir, publicPath) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      injectScript(fullPath, publicPath);
    } else if (file.endsWith(".html")) {
      let content = fs.readFileSync(fullPath, "utf8");
      if (!content.includes("browser-check.js")) {
        content = content.replace(
          /<\/body>/i,
          `<script src="${publicPath}browser-check.js"></script>\n</body>`
        );
        fs.writeFileSync(fullPath, content, "utf8");
        console.log(`📄 Script injetado em: ${fullPath}`);
      }
    }
  }
}
