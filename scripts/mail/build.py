# Baut die Supabase-Auth-Mailvorlagen v2 (Foto-Kopf, Ticket-Code, dunkler Fuß)
import json, os
B = 'https://fwiivwmoyagcdrjvhaou.supabase.co/storage/v1/object/public/sva_public/mail/'
V = 'v2'
F = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
MONO = "'SF Mono',Menlo,Consolas,'Courier New',monospace"


def mail(hero, alt, preheader, lead, button, code=True, code_label='Oder diesen Code eingeben', note=''):
    btn = ''
    if button:
        btn = f'''<tr><td style="padding:6px 40px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#e91d29" style="border-radius:12px;background-color:#e91d29">
<a href="{{{{ .ConfirmationURL }}}}" style="display:block;padding:18px 20px;font-family:{F};font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">{button} &rarr;</a></td></tr></table></td></tr>'''
    tok = ''
    if code:
        tok = f'''<tr><td style="padding:{'18' if button else '6'}px 40px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#f6f2f1" style="background:#f6f2f1;border:1px dashed #d9cfcd;border-radius:12px;padding:20px 12px 18px">
<p style="margin:0 0 8px;font-family:{F};font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#8a8183">{code_label}</p>
<p style="margin:0;font-family:{MONO};font-size:36px;line-height:1.1;font-weight:700;letter-spacing:10px;color:#141112">{{{{ .Token }}}}</p>
<p style="margin:8px 0 0;font-family:{F};font-size:12px;color:#8a8183">gilt 60 Minuten &middot; nur einmal nutzbar</p>
</td></tr></table></td></tr>'''
    return f'''<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>{alt}</title>
<style>@media (max-width:620px){{.aussen{{padding:0!important}}.karte{{border-radius:0!important}}.pad{{padding-left:24px!important;padding-right:24px!important}}}}a{{text-decoration:none}}</style></head>
<body style="margin:0;padding:0;background:#ebe6e5;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">{preheader}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ebe6e5" style="background:#ebe6e5"><tr><td class="aussen" align="center" style="padding:32px 12px">
<table role="presentation" class="karte" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="padding:0;line-height:0;background:#0d0b0c"><img src="{B}hero-{hero}-{V}.jpg" width="600" alt="{alt}" style="display:block;width:100%;height:auto;border:0;color:#ffffff;font-family:{F};font-size:22px;font-weight:700"></td></tr>
<tr><td class="pad" style="padding:34px 40px 22px;font-family:{F}">
<p style="margin:0 0 6px;font-size:22px;line-height:1.3;font-weight:800;color:#141112">Moin!</p>
<p style="margin:0;font-size:16px;line-height:1.6;color:#4a4446">{lead}</p>
</td></tr>
{btn}
{tok}
<tr><td class="pad" style="padding:26px 40px 34px;font-family:{F}">
<p style="margin:0;font-size:13px;line-height:1.6;color:#8a8183">{note or 'Du hast das nicht angefordert? Dann ignoriere diese Mail einfach, es passiert nichts.'}</p>
</td></tr>
<tr><td bgcolor="#141112" style="background:#141112;padding:26px 40px" class="pad">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="44" valign="middle" style="padding-right:14px"><img src="{B}wappen-{V}.png" width="40" alt="" style="display:block;border:0;width:40px;height:auto"></td>
<td valign="middle" style="font-family:{F}">
<p style="margin:0;font-size:14px;font-weight:800;letter-spacing:.5px;color:#ffffff">SV Agathenburg-Dollern</p>
<p style="margin:2px 0 0;font-size:12px;color:#9b9193">Ein Dorf. Ein Verein. Ein Platz.</p></td>
</tr></table>
<p style="margin:18px 0 0;font-family:{F};font-size:13px;line-height:1.5">
<a href="{{{{ .SiteURL }}}}" style="color:#ffffff;font-weight:700">Website</a><span style="color:#5a5153">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span><a href="https://instagram.com/svagathenburg" style="color:#ffffff;font-weight:700">Instagram</a><span style="color:#5a5153">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span><a href="{{{{ .SiteURL }}}}/live" style="color:#ffffff;font-weight:700">Spieltag live</a></p>
<p style="margin:14px 0 0;font-family:{F};font-size:11px;line-height:1.5;color:#6f6567">SV Agathenburg-Dollern von 1949 e.V. &middot; Waldsportplatz Agathenburg</p>
</td></tr>
</table></td></tr></table></body></html>'''


T = {
    'magic_link': ('Dein SVA-Login: {{ .Token }}', mail(
        'login', 'Dein Login', 'Dein Code: {{ .Token }} · gilt 60 Minuten',
        'Tipp auf den Knopf, und du bist drin. Der Link gilt 60 Minuten und funktioniert nur einmal.',
        'Jetzt anmelden')),
    'confirmation': ('Willkommen beim SVA – bitte kurz bestätigen', mail(
        'willkommen', 'Willkommen beim SVA', 'Ein Tipp noch, dann bist du dabei. Code: {{ .Token }}',
        'Schön, dass du dabei bist. Bestätige kurz deine E-Mail-Adresse, dann ist dein Konto startklar.',
        'E-Mail bestätigen', note='Du hast dich nicht beim SVA angemeldet? Dann ignoriere diese Mail einfach, ohne Bestätigung wird kein Konto aktiv.')),
    'invite': ('Du bist eingeladen: SVA Vereins-Pflege', mail(
        'team', 'Willkommen im Team', 'Du wurdest zur Vereins-Pflege des SVA eingeladen.',
        'Du wurdest zur Vereins-Pflege des SV Agathenburg-Dollern eingeladen. Damit pflegst du Kader, Aufstellung, Spiele und den Liveticker, ganz einfach vom Handy.',
        'Einladung annehmen', code=False, note='Du erwartest keine Einladung? Dann ignoriere diese Mail einfach.')),
    'recovery': ('Neues Passwort für deinen SVA-Login', mail(
        'passwort', 'Neues Passwort', 'Hier kannst du dein Passwort neu festlegen. Code: {{ .Token }}',
        'Du möchtest ein neues Passwort? Tipp auf den Knopf, du wirst angemeldet und kannst es direkt unter „Konto“ neu festlegen.',
        'Weiter zum neuen Passwort', note='Du hast kein neues Passwort angefordert? Dann ignoriere diese Mail einfach, dein altes Passwort bleibt gültig.')),
    'email_change': ('Bitte bestätige deine neue E-Mail-Adresse', mail(
        'email', 'Neue E-Mail-Adresse', 'Bestätige {{ .NewEmail }} als neue Adresse für deinen SVA-Login.',
        'Du willst deinen SVA-Login auf <strong style="color:#141112">{{ .NewEmail }}</strong> umstellen. Bestätige die neue Adresse mit einem Tipp.',
        'Neue Adresse bestätigen', note='Das warst du nicht? Dann ignoriere diese Mail, es bleibt alles, wie es ist.')),
    'reauthentication': ('{{ .Token }} ist dein SVA-Bestätigungscode', mail(
        'login', 'Bestätigungscode', 'Dein Bestätigungscode: {{ .Token }}',
        'Zur Sicherheit brauchen wir noch einmal deine Bestätigung. Gib diesen Code in der Vereins-Pflege ein.',
        None, code_label='Dein Bestätigungscode')),
}

out = os.path.dirname(os.path.abspath(__file__))
patch = {}
for k, (subj, html) in T.items():
    patch[f'mailer_subjects_{k}'] = subj
    patch[f'mailer_templates_{k}_content'] = html
    open(os.path.join(out, f'v2-{k}.html'), 'w').write(html)
    print(k, len(html.encode()), 'Bytes')
json.dump(patch, open(os.path.join(out, 'patch-v2.json'), 'w'), ensure_ascii=False)
