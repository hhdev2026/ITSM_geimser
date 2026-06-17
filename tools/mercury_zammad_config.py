"""
mercury_zammad_config.py
Configura Mercury 2 (Inception Labs) como proveedor IA en Zammad 7.0+
"""

import os
import requests
import json

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
# Nunca hardcodear claves aquí. Exporta las variables antes de ejecutar, p.ej.:
#   export MERCURY_API_KEY=sk_...
#   export ZAMMAD_TOKEN=...
#   python tools/mercury_zammad_config.py
MERCURY_API_KEY  = os.environ.get("MERCURY_API_KEY", "")
MERCURY_BASE_URL = os.environ.get("MERCURY_BASE_URL", "https://api.inceptionlabs.ai/v1")
MERCURY_MODEL    = os.environ.get("MERCURY_MODEL", "mercury-2")

ZAMMAD_URL       = os.environ.get("ZAMMAD_URL", "https://itsm.geimser.cl")   # sin barra final
ZAMMAD_TOKEN     = os.environ.get("ZAMMAD_TOKEN", "")                         # token de admin de Zammad
# ──────────────────────────────────────────────────────────────────────────────


def get_zammad_headers():
    return {
        "Authorization": f"Token token={ZAMMAD_TOKEN}",
        "Content-Type":  "application/json",
    }


def configure_mercury_in_zammad():
    """
    Configura el proveedor IA en Zammad usando el endpoint compatible con OpenAI de Mercury 2.
    Equivale a: Admin → AI → Provider → Custom OpenAI-compatible endpoint
    """
    if not ZAMMAD_TOKEN:
        print("⚠️  ZAMMAD_TOKEN vacío — completa la variable antes de ejecutar.")
        return False

    payload = {
        "ai_provider": {
            "type":    "open_ai_compatible",
            "api_key": MERCURY_API_KEY,
            "url":     MERCURY_BASE_URL,
            "model":   MERCURY_MODEL,
        }
    }

    url = f"{ZAMMAD_URL}/api/v1/ai_provider"
    resp = requests.put(url, headers=get_zammad_headers(), json=payload, timeout=15)

    if resp.status_code in (200, 201):
        print("✅ Proveedor IA configurado correctamente en Zammad.")
        print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
        return True
    else:
        print(f"❌ Error al configurar Zammad: {resp.status_code}")
        print(resp.text)
        return False


if __name__ == "__main__":
    if not MERCURY_API_KEY:
        print("⚠️  MERCURY_API_KEY vacío — exporta la variable antes de ejecutar.")
    else:
        configure_mercury_in_zammad()
