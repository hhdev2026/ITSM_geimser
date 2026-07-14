# Secretos Seguros

Modulo integrado al ITSM para compartir contrasenas, tokens y mensajes sensibles mediante enlaces temporales de una sola lectura.

## Variable obligatoria

Define una clave maestra estable de 32 bytes:

```powershell
$env:GEIMSER_SECURE_SECRETS_KEY = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

En Linux o dentro del servidor:

```bash
openssl rand -base64 32
```

Guarda el valor en el `.env` o en las variables del servidor:

```env
GEIMSER_SECURE_SECRETS_KEY=valor_base64_de_32_bytes
```

No cambies esta clave mientras existan secretos activos, porque no se podran descifrar.

## Rutas

- `#secure-secrets`: pantalla interna autenticada.
- `POST /api/secure-secrets`: crea un secreto.
- `GET /api/secure-secrets`: lista metadatos.
- `DELETE /api/secure-secrets/:id`: elimina un enlace activo.
- `GET /secure-secrets/s/:token`: vista publica del destinatario.
- `POST /api/secure-secrets/public/:token/reveal`: revela y consume el secreto.

## Seguridad aplicada

- AES-256-GCM.
- Token publico de 256 bits.
- La base guarda hash SHA-256 del token, no el token completo.
- El secreto no se guarda en texto plano.
- El payload cifrado se elimina al consumirse, expirar o borrarse.
- La vista publica usa `Cache-Control: no-store`, `noindex` y `nofollow`.
- El secreto se consume solo con `POST`, no al abrir el enlace.
