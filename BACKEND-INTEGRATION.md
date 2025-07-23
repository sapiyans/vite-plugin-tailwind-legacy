[⬅️ Voltar para o README principal](./README.md)

# 🔧 Integração Backend com vite-plugin-tailwind-legacy

🖥️ Implementação Django (Exemplo)

```python
# Funções auxiliares para extrair versões
def extract_chrome_version(user_agent):
    match = re.search(r'chrome/(\d+)', user_agent)
    return int(match.group(1)) if match else None

def extract_firefox_version(user_agent):
    match = re.search(r'firefox/(\d+)', user_agent)
    return int(match.group(1)) if match else None

def extract_safari_version(user_agent):
    match = re.search(r'version/(\d+\.\d+)', user_agent)
    return float(match.group(1)) if match else None


def IndexView(request, page=None):
    user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
    html_content = render_to_string(f"{page or 'index'}.html", request=request)
    
    # Extrair versões dos navegadores
    chrome_version = extract_chrome_version(user_agent)
    is_firefox = 'firefox' in user_agent
    firefox_version = extract_firefox_version(user_agent)
    is_safari = 'safari' in user_agent and 'chrome' not in user_agent
    safari_version = extract_safari_version(user_agent)
    
    # Definir versões mínimas
    MIN_CHROME = 111
    MIN_SAFARI = 16.4
    MIN_FIREFOX = 128
    
    # Verificar se o navegador é antigo
    is_legacy_browser = (
        (chrome_version and chrome_version < MIN_CHROME) or
        (is_safari and safari_version and safari_version < MIN_SAFARI) or
        (is_firefox and firefox_version and firefox_version < MIN_FIREFOX)
    )
    
    if is_legacy_browser:

        html_content = re.sub(
            r'<link\b(?![^>]*cookieconsent)[^>]*?\brel=["\']stylesheet["\'][^>]*>', # aqui você pode impedir que retire um css que vai precisar
            '',
            html_content,
            flags=re.IGNORECASE | re.DOTALL
        )

        html_content = re.sub(
            r'<style\b(?![^>]*cookieconsent)[^>]*>.*?<\/style>', # aqui você pode impedir que retire um css que vai precisar
            '',
            html_content,
            flags=re.IGNORECASE | re.DOTALL
        )

        # Injetar Tailwind v3
        css_injection = '''
        <!-- Tailwind v3 para navegadores legados -->
        <link rel="stylesheet" href="https://exemplo.com.br/static/output.css">
        '''
        
        # Injeção robusta mesmo em HTML minificado
        html_content = re.sub(
            r'(<head[^>]*>)', 
            r'\1' + css_injection,
            html_content,
            flags=re.IGNORECASE
        )
    
    return HttpResponse(html_content)

```

