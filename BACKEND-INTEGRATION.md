[⬅️ Back to main README](./README.md)

🔧 Backend Integration with vite-plugin-tailwind-legacy

🖥️ Django Implementation (Example)

```python
# Helper functions to extract browser versions
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
    
    # Extract browser versions
    chrome_version = extract_chrome_version(user_agent)
    is_firefox = 'firefox' in user_agent
    firefox_version = extract_firefox_version(user_agent)
    is_safari = 'safari' in user_agent and 'chrome' not in user_agent
    safari_version = extract_safari_version(user_agent)
    
    # Define minimum versions
    MIN_CHROME = 111
    MIN_SAFARI = 16.4
    MIN_FIREFOX = 128
    
    # Check if browser is legacy
    is_legacy_browser = (
        (chrome_version and chrome_version < MIN_CHROME) or
        (is_safari and safari_version and safari_version < MIN_SAFARI) or
        (is_firefox and firefox_version and firefox_version < MIN_FIREFOX)
    )
    
    if is_legacy_browser:
        # Remove existing stylesheets (except those with 'cookieconsent' attribute)
        html_content = re.sub(
            r'<link\b(?![^>]*cookieconsent)[^>]*?\brel=["\']stylesheet["\'][^>]*>', # you can exclude specific CSS files by adding the cookieconsent attribute
            '',
            html_content,
            flags=re.IGNORECASE | re.DOTALL
        )

        # Remove existing inline styles (except those with 'cookieconsent' attribute)
        html_content = re.sub(
            r'<style\b(?![^>]*cookieconsent)[^>]*>.*?<\/style>', # you can exclude specific inline styles by adding the cookieconsent attribute
            '',
            html_content,
            flags=re.IGNORECASE | re.DOTALL
        )

        # Inject Tailwind v3 for legacy browsers
        css_injection = '''
        <!-- Tailwind v3 for legacy browsers -->
        <link rel="stylesheet" href="/static/assets/tailwind-v3-legacy.css">
        '''
        
        # Robust injection even for minified HTML
        html_content = re.sub(
            r'(<head[^>]*>)', 
            r'\1' + css_injection,
            html_content,
            flags=re.IGNORECASE
        )
    
    return HttpResponse(html_content)
```

