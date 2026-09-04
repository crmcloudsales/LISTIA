from pathlib import Path

path=Path('public/google-ads-connect.js')
text=path.read_text(encoding='utf-8')

old="function configured(conn){const m=conn?.metadata||{},a=m.conversion_actions||{};return /^\\d{10}$/.test(String(m.google_ads_customer_id||''))&&Object.values(a).some(v=>/^\\d+$/.test(String(v||'')));}"
new="function configured(conn){const m=conn?.metadata||{},a=m.conversion_actions||{};return /^\\d{10}$/.test(String(m.google_ads_customer_id||''))&&['qualified_lead','appointment','conversion'].every(k=>/^\\d+$/.test(String(a[k]||'')));}"
if new not in text:
    if text.count(old)!=1: raise SystemExit(f'configured readiness anchor mismatch: {text.count(old)}')
    text=text.replace(old,new,1)

replacements={
"Después de autorizar, agrega el Customer ID y al menos un ID de acción de conversión.":"Después de autorizar, agrega el Customer ID y las acciones para lead calificado, cita y conversión.",
"After authorization, add the Customer ID and at least one conversion action ID.":"After authorization, add the Customer ID and actions for qualified lead, appointment and conversion.",
"Ajoutez ensuite l’ID client et au moins un ID d’action de conversion.":"Ajoutez ensuite l’ID client et les actions pour prospect qualifié, rendez-vous et conversion.",
"Dopo l’autorizzazione aggiungi il Customer ID e almeno un ID di conversione.":"Dopo l’autorizzazione aggiungi il Customer ID e le azioni per lead qualificato, appuntamento e conversione.",
"Depois, adicione o Customer ID e pelo menos um ID de ação de conversão.":"Depois, adicione o Customer ID e as ações para lead qualificado, agendamento e conversão.",
"Danach Customer ID und mindestens eine Conversion-Aktions-ID hinzufügen.":"Danach Customer ID und die Aktionen für qualifizierten Lead, Termin und Conversion hinzufügen.",
"بعد التفويض أضف معرّف العميل ومعرّف إجراء تحويل واحد على الأقل.":"بعد التفويض أضف معرّف العميل وإجراءات العميل المؤهل والموعد والتحويل.",
"После авторизации добавьте Customer ID и хотя бы один ID действия-конверсии.":"После авторизации добавьте Customer ID и действия для качественного лида, встречи и конверсии.",
"לאחר האישור הוסף Customer ID ולפחות מזהה פעולת המרה אחד.":"לאחר האישור הוסף Customer ID ופעולות עבור ליד איכותי, פגישה והמרה.",
"授权后添加客户 ID 和至少一个转化操作 ID。":"授权后添加客户 ID，以及高质量线索、预约和转化三类操作。",
"承認後、Customer ID と少なくとも1つのコンバージョン アクション IDを追加してください。":"承認後、Customer ID と有望リード、予約、成約の各コンバージョン アクションを追加してください。",
}
for old_text,new_text in replacements.items():
    if new_text in text: continue
    if text.count(old_text)!=1: raise SystemExit(f'copy anchor mismatch: {old_text!r} count={text.count(old_text)}')
    text=text.replace(old_text,new_text,1)

for needle in [
    "['qualified_lead','appointment','conversion'].every",
    "acciones para lead calificado, cita y conversión",
    "actions for qualified lead, appointment and conversion",
]:
    if needle not in text: raise SystemExit(f'missing readiness UI contract: {needle}')

path.write_text(text,encoding='utf-8')
