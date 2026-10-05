# DNS-Einträge für aga-erste.de (bei IONOS eintragen)

Für den Mailversand über Resend (Anmelde-Mails von Admin und Album). **Bestehende Einträge (MX für info@aga-erste.de) NICHT ändern**, nur diese hinzufügen.

IONOS: Domains & SSL → aga-erste.de → DNS → Eintrag hinzufügen

| Typ | Hostname | Wert | Priorität |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDG3VcRJOZezymhgW5FbCA68yEzU+LwjYGBujWxEDoCsKHIspCZwWLNJ1uwZHcb0pC2RdsCaO8717KmeZwJ0QviKS061PmLoppNa/Onw0mMTWlmZZLe6hcZzXKju3abRAsaJPynZGmV8xWD60+5XJM8O5l50eRqIJe4s8bIDO6MAQIDAQAB` |  |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |  |
| CNAME | `rsend` | `send.forge.rmta.net` |  |

Hinweis: Bei IONOS wird der Hostname ohne `.aga-erste.de` eingegeben (also nur `send`, `resend._domainkey`, `rsend`).
Danach sagt Marvin Bescheid, dann prüfe ich die Verifizierung bei Resend und schalte den Versand in Supabase scharf.
