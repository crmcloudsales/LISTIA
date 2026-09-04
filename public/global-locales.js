(() => {
  const EXTRA = {
    ru: {
      html: 'ru-RU', manifest: 'ru', direction: 'ltr', aliases: ['ru','ru-ru'], label: 'Русский',
      strings: {
        'language.label':'Выбрать язык','common.back':'Назад','common.show':'Показать','common.hide':'Скрыть','common.continue':'Продолжить','common.month':'/мес.','common.your_business':'ваш бизнес','common.your_workspace':'Ваше рабочее пространство','common.connected_account':'Подключённый аккаунт','common.logout':'Выйти',
        'login.title':'Войти','login.subtitle':'Войдите в аккаунт, чтобы продолжить.','login.email':'Электронная почта','login.password':'Пароль','login.email_placeholder':'name@company.com','login.submit':'Войти','login.forgot':'Забыли пароль?','login.no_account':'Ещё нет аккаунта?','login.create_account':'Создать аккаунт',
        'signup.eyebrow':'НАЧАТЬ','signup.title':'Создать аккаунт','signup.subtitle':'Нам нужны только основные данные, чтобы открыть ваше рабочее пространство.','signup.name':'Имя','signup.name_placeholder':'Ваше имя','signup.email':'Электронная почта','signup.password':'Пароль','signup.password_placeholder':'Минимум 12 символов','signup.terms':'Я принимаю Условия и Политику конфиденциальности.','signup.submit':'Создать мой аккаунт','signup.have_account':'У меня уже есть аккаунт',
        'forgot.eyebrow':'ВОССТАНОВЛЕНИЕ','forgot.title':'Восстановить доступ','forgot.subtitle':'Мы отправим безопасную ссылку для сброса пароля.','forgot.email':'Электронная почта','forgot.submit':'Отправить ссылку','reset.eyebrow':'БЕЗОПАСНОСТЬ','reset.title':'Новый пароль','reset.subtitle':'Создайте новый пароль для восстановления аккаунта.','reset.new_password':'Новый пароль','reset.confirm_password':'Подтвердить пароль','reset.confirm_placeholder':'Повторите пароль','reset.submit':'Сохранить пароль',
        'onboarding.step1':'НАСТРОЙКА · 1 ИЗ 5','onboarding.title':'Расскажите о вашем бизнесе','onboarding.subtitle':'LISTIA использует эти данные, чтобы подготовить ваше рабочее пространство.','onboarding.business_name':'Название бизнеса','onboarding.business_name_placeholder':'Напр. Riviera Realty','onboarding.business_type':'Тип бизнеса','onboarding.select_option':'Выберите вариант','onboarding.type_advisor':'Независимый консультант по недвижимости','onboarding.type_agency':'Агентство недвижимости / брокер','onboarding.type_developer':'Девелопер','onboarding.type_other':'Другой бизнес в сфере недвижимости','onboarding.market':'Основной город или рынок','onboarding.market_placeholder':'Напр. Москва',
        'plan.step':'НАСТРОЙКА · 2 ИЗ 5','plan.title':'Выберите, как начать','plan.subtitle':'План можно изменить позже. Выбор Pro или Premium здесь ещё не запускает оплату.','plan.configuring':'Настройка','plan.free_desc':'До 3 объектов. Начните с LISTIA и оплачивайте только одобренные Gestiones.','plan.pro_desc':'Для профессионала по недвижимости, который хочет автоматизировать работу.','plan.premium_desc':'Включает 2 пользователей и самый низкий тариф на использование.',
        'google.step':'НАСТРОЙКА · 3 ИЗ 5','google.title':'Подключите экосистему Google','google.subtitle':'Одного подключения достаточно, чтобы LISTIA начала с Drive и Calendar. Gmail, Контакты, Analytics, YouTube и другие сервисы будут добавляться только по необходимости.','google.configuring':'Настройка','google.permissions_title':'LISTIA начинает с минимальных разрешений.','google.permissions_body':'Мы не запрашиваем доступ ко всему Google сразу. Дополнительные разрешения будут запрашиваться постепенно.','google.connect':'Подключить Google','google.skip':'Не сейчас',
        'checkpoint.step':'НАСТРОЙКА · 4 ИЗ 5','checkpoint.title':'Мы нашли то, что у вас уже есть','checkpoint.subtitle':'LISTIA проверит только уже разрешённые источники, чтобы найти материалы и инвентарь без повторного ввода данных.','checkpoint.account':'✓ Аккаунт LISTIA','checkpoint.business':'✓ Бизнес','checkpoint.plan':'✓ План выбран','checkpoint.google_checking':'Google: проверка подключения…','checkpoint.google_connected':'✓ Google подключён','checkpoint.google_not_connected':'Google не подключён',
        'discovery.title':'Поиск / Импорт','discovery.subtitle':'Начинаем с источников, которые вы уже разрешили.','discovery.waiting':'Подготовка','discovery.scanning':'Поиск…','discovery.ready':'Готово','discovery.calendar_checking':'Calendar…','discovery.calendar_ready':'✓ Calendar готов','discovery.calendar_none':'Calendar ожидает','discovery.loading':'LISTIA проверяет доступные данные с текущими разрешениями…','discovery.summary_found':'Найдено доступных файлов Drive: {{count}}. Они выбраны заранее; снимите выбор с тех, которые не хотите импортировать.','discovery.summary_none':'С текущими минимальными разрешениями файлы Drive не видны. Можно продолжить без импорта.','discovery.summary_no_google':'Google не подключён. Можно продолжить и добавить источники позже.','discovery.minimum_permissions':'Конфиденциальность прежде всего.','discovery.drive_file_note':'LISTIA видит только файлы, которые вы явно выбрали для LISTIA, или файлы, созданные LISTIA. Мы не открываем весь ваш Drive.','discovery.scan_again':'Искать снова','discovery.type_property_document':'Документ объекта','discovery.type_image':'Изображение','discovery.type_video':'Видео','discovery.type_spreadsheet':'Таблица','discovery.type_folder':'Папка','discovery.type_calendar':'Календарь','discovery.type_brand_asset':'Материал бренда','discovery.type_other':'Другое','discovery.untitled':'Без названия','discovery.file_selected':'Выбрано для импорта','discovery.file_not_selected':'Не импортировать','discovery.error':'Не удалось завершить поиск. Повторите попытку или продолжите.',
        'dna.step':'НАСТРОЙКА · 5 ИЗ 5','dna.title':'Ваш Business DNA начинается здесь','dna.subtitle':'У LISTIA уже есть реальная основа вашего бизнеса. Она будет обогащаться вашим инвентарём и активностью без лишних форм.','dna.business':'Бизнес','dna.market':'Рынок','dna.google':'Google','dna.assets':'Найденные материалы','dna.connected':'Подключено','dna.not_connected':'Не подключено','dna.continuous_title':'Business DNA развивается постоянно.','dna.continuous_body':'Не нужно заполнять длинную анкету. LISTIA будет учиться на ваших объектах, бренде, контенте и результатах по мере работы.','dna.finish':'Подтвердить и войти в LISTIA',
        'ready.title':'Рабочее пространство готово','ready.subtitle':'Настройка завершена. LISTIA может продолжать учиться на вашем инвентаре и активности.',
        'office.eyebrow':'ОФИС','office.title':'Весь ваш бизнес в одном месте','office.subtitle':'LISTIA показывает, что она делает и что требует вашего внимания.','office.add_material':'Передать LISTIA материалы объекта','office.add_material_hint':'PDF, фото, видео или описание. Остальное сделает LISTIA.','office.today_appointments':'Встречи сегодня','office.opportunities':'Новые возможности','office.managed_leads':'Обработанные лиды','office.active_properties':'Активные объекты','office.properties':'Объекты','office.properties_hint':'Инвентарь и полученные материалы','office.google_checking':'Проверка подключения…','office.google_connected':'Подключено','office.google_not_connected':'Не подключено',
        'properties.eyebrow':'ОБЪЕКТЫ','properties.title':'Ваш инвентарь','properties.subtitle':'Вы передаёте материалы. LISTIA создаёт объект и продолжает подготовку.','properties.add':'Передать материалы LISTIA','properties.empty_title':'Первый объект начинается с того, что у вас уже есть.','properties.empty_body':'Это может быть PDF, фото, видео или простое описание.','properties.status_material_received':'Материалы получены','properties.status_processing':'LISTIA готовит','properties.status_ready':'Готово','properties.status_published':'Опубликовано','properties.status_archived':'В архиве','properties.status_error':'Нужна проверка','properties.no_location':'Местоположение не указано','properties.no_price':'Цена не указана','properties.sale':'Продажа','properties.rent':'Аренда',
        'intake.eyebrow':'НОВЫЙ ОБЪЕКТ','intake.title':'Дайте мне то, что у вас есть','intake.subtitle':'Не заполняйте ещё один портал. Загрузите имеющиеся материалы, и LISTIA начнёт готовить объект.','intake.files':'PDF, фото, видео или прайс-лист','intake.files_hint':'Можно выбрать несколько файлов. Максимум 50 МБ на файл.','intake.description':'Описание или имеющийся текст','intake.optional':'необязательно','intake.description_placeholder':'Вставьте всю имеющуюся информацию. Её не нужно заранее организовывать.','intake.operation':'Операция','intake.unknown':'Не знаю / пока нет','intake.sale':'Продажа','intake.rent':'Аренда','intake.price':'Цена','intake.currency':'Валюта','intake.commission':'Комиссия','intake.commission_placeholder':'Напр. 5%','intake.location':'Местоположение или район','intake.location_placeholder':'Напр. Dubai Marina','intake.postal':'Почтовый индекс','intake.simple_title':'Необязательно иметь всё.','intake.simple_body':'Если чего-то не хватает, LISTIA извлечёт это из материалов или запросит только необходимое.','intake.submit':'LISTIA, подготовь этот объект','intake.free_note':'Free включает до 3 объектов.','intake.files_selected':'Выбрано файлов: {{count}}','intake.uploading':'Загрузка {{current}} из {{total}}…',
        'msg.property_material_required':'Добавьте хотя бы файл, описание, цену или местоположение.','msg.file_too_large':'Один из файлов превышает 50 МБ.','msg.file_type_not_allowed':'Этот тип файла пока не поддерживается.','msg.property_creating':'Подготовка пространства объекта…','msg.property_received':'Материалы получены. LISTIA создала объект в вашем инвентаре.','msg.property_partial_upload':'Объект создан, но некоторые файлы не загрузились. Можно повторить попытку.','msg.free_property_limit':'Free включает до 3 активных объектов. Архивируйте один объект, чтобы освободить место, или смените план.','msg.properties_load_error':'Не удалось загрузить объекты.','msg.upload_failed':'Не удалось загрузить один из файлов.','msg.discovery_loading':'Поиск материалов…','msg.discovery_completed':'Поиск завершён.','msg.discovery_selection_saved':'Выбор обновлён.','msg.finishing_onboarding':'Подготовка LISTIA…','msg.onboarding_completed':'Настройка завершена.','msg.workspace_load_error':'Не удалось загрузить рабочее пространство. Повторите попытку.','msg.invalid_email':'Введите действительный адрес электронной почты.','msg.password_min8':'Пароль должен содержать минимум 8 символов.','msg.password_min8_signup':'Используйте пароль минимум из 12 символов.','msg.login_loading':'Вход…','msg.login_success':'Вход выполнен.','msg.invalid_login':'Неверная почта или пароль, либо адрес ещё не подтверждён.','msg.name_required':'Введите имя.','msg.terms_required':'Необходимо принять Условия и Политику конфиденциальности.','msg.signup_loading':'Создание аккаунта…','msg.account_created':'Аккаунт создан.','msg.account_created_confirm':'Аккаунт создан. Проверьте почту для подтверждения доступа.','msg.sending':'Отправка…','msg.recovery_sent':'Если адрес существует, вы получите ссылку для восстановления.','msg.password_mismatch':'Пароли не совпадают.','msg.recovery_expired':'Ссылка восстановления недействительна. Запросите новую.','msg.saving':'Сохранение…','msg.password_updated':'Пароль обновлён.','msg.complete_three_fields':'Заполните все три поля, чтобы продолжить.','msg.session_expired':'Сессия истекла. Войдите снова.','msg.workspace_created_load_error':'Рабочее пространство создано, но его не удалось загрузить. Обновите страницу.','msg.workspace_created':'Рабочее пространство создано.','msg.business_not_found':'Ваш бизнес не найден.','msg.plan_saved':'План сохранён.','msg.google_opening':'Открываем Google…','msg.google_not_ready':'Google пока не готов к подключению.','msg.continuing':'Продолжаем…','msg.google_first':'Сначала подключите Google.','msg.google_connected':'Google успешно подключён.','msg.logout':'Вы вышли из аккаунта.','msg.config_incomplete':'Настройка доступа не завершена.','msg.google_connected_return':'Google успешно подключён.','msg.google_cancelled':'Подключение Google отменено.','msg.google_error':'Не удалось подключить Google.','msg.email_not_confirmed':'Подтвердите электронную почту, прежде чем продолжить.','msg.user_exists':'Аккаунт с этой почтой уже существует.','msg.rate_limited':'Слишком много попыток. Подождите и попробуйте снова.','msg.generic_error':'Произошла ошибка. Попробуйте снова.'
      }
    },
    he: {
      html: 'he-IL', manifest: 'he', direction: 'rtl', aliases: ['he','he-il','iw','iw-il'], label: 'עברית',
      strings: {
        'language.label':'בחירת שפה','common.back':'חזרה','common.show':'הצג','common.hide':'הסתר','common.continue':'המשך','common.month':'/חודש','common.your_business':'העסק שלך','common.your_workspace':'סביבת העבודה שלך','common.connected_account':'חשבון מחובר','common.logout':'יציאה',
        'login.title':'כניסה','login.subtitle':'היכנס לחשבון כדי להמשיך.','login.email':'דואר אלקטרוני','login.password':'סיסמה','login.email_placeholder':'name@company.com','login.submit':'כניסה','login.forgot':'שכחת את הסיסמה?','login.no_account':'עדיין אין לך חשבון?','login.create_account':'יצירת חשבון',
        'signup.eyebrow':'מתחילים','signup.title':'יצירת חשבון','signup.subtitle':'אנחנו צריכים רק את הפרטים הבסיסיים כדי לפתוח את סביבת העבודה שלך.','signup.name':'שם','signup.name_placeholder':'השם שלך','signup.email':'דואר אלקטרוני','signup.password':'סיסמה','signup.password_placeholder':'לפחות 12 תווים','signup.terms':'אני מסכים לתנאים ולמדיניות הפרטיות.','signup.submit':'צור את החשבון שלי','signup.have_account':'כבר יש לי חשבון',
        'forgot.eyebrow':'שחזור','forgot.title':'שחזור גישה','forgot.subtitle':'נשלח קישור מאובטח לאיפוס הסיסמה.','forgot.email':'דואר אלקטרוני','forgot.submit':'שליחת קישור','reset.eyebrow':'אבטחה','reset.title':'סיסמה חדשה','reset.subtitle':'צור סיסמה חדשה כדי לשחזר את החשבון.','reset.new_password':'סיסמה חדשה','reset.confirm_password':'אישור סיסמה','reset.confirm_placeholder':'הקלד שוב את הסיסמה','reset.submit':'שמירת סיסמה',
        'onboarding.step1':'הגדרה · 1 מתוך 5','onboarding.title':'ספר לנו על העסק שלך','onboarding.subtitle':'LISTIA תשתמש במידע כדי להכין את סביבת העבודה שלך.','onboarding.business_name':'שם העסק','onboarding.business_name_placeholder':'לדוגמה Riviera Realty','onboarding.business_type':'סוג העסק','onboarding.select_option':'בחר אפשרות','onboarding.type_advisor':'יועץ נדל״ן עצמאי','onboarding.type_agency':'סוכנות נדל״ן / ברוקר','onboarding.type_developer':'יזם נדל״ן','onboarding.type_other':'עסק נדל״ן אחר','onboarding.market':'עיר או שוק מרכזי','onboarding.market_placeholder':'לדוגמה תל אביב',
        'plan.step':'הגדרה · 2 מתוך 5','plan.title':'בחר איך להתחיל','plan.subtitle':'אפשר לשנות מסלול בהמשך. בחירת Pro או Premium כאן עדיין אינה מחייבת בתשלום.','plan.configuring':'הגדרה','plan.free_desc':'כולל עד 3 נכסים. התחל עם LISTIA ושלם רק על Gestiones שאישרת.','plan.pro_desc':'לאיש מקצוע בנדל״ן שרוצה להפוך את העבודה לאוטומטית.','plan.premium_desc':'כולל 2 משתמשים ואת תעריף השימוש הנמוך ביותר.',
        'google.step':'הגדרה · 3 מתוך 5','google.title':'חבר את סביבת Google שלך','google.subtitle':'חיבור אחד מאפשר ל-LISTIA להתחיל עם Drive ו-Calendar. Gmail, אנשי קשר, Analytics, YouTube ושירותים נוספים יתווספו רק כשצריך.','google.configuring':'הגדרה','google.permissions_title':'LISTIA מתחילה בהרשאות מינימליות.','google.permissions_body':'לא נבקש גישה לכל Google בבת אחת. הרשאות נוספות יתבקשו בהדרגה.','google.connect':'חיבור Google','google.skip':'לא עכשיו',
        'checkpoint.step':'הגדרה · 4 מתוך 5','checkpoint.title':'מצאנו את מה שכבר יש לך','checkpoint.subtitle':'LISTIA תבדוק רק מקורות שכבר אישרת כדי לזהות חומרים ומלאי בלי להתחיל מחדש.','checkpoint.account':'✓ חשבון LISTIA','checkpoint.business':'✓ עסק','checkpoint.plan':'✓ מסלול נבחר','checkpoint.google_checking':'Google: בודק חיבור…','checkpoint.google_connected':'✓ Google מחובר','checkpoint.google_not_connected':'Google לא מחובר',
        'discovery.title':'גילוי / ייבוא','discovery.subtitle':'מתחילים מהמקורות שכבר אישרת.','discovery.waiting':'הכנה','discovery.scanning':'מחפש…','discovery.ready':'מוכן','discovery.calendar_checking':'Calendar…','discovery.calendar_ready':'✓ Calendar מוכן','discovery.calendar_none':'Calendar ממתין','discovery.loading':'LISTIA בודקת מה ניתן לראות עם ההרשאות הנוכחיות…','discovery.summary_found':'נמצאו {{count}} קבצים נגישים ב-Drive. הם מסומנים מראש; בטל סימון למה שאינך רוצה לייבא.','discovery.summary_none':'לא נמצאו קבצי Drive עם ההרשאה המינימלית הנוכחית. אפשר להמשיך בלי ייבוא.','discovery.summary_no_google':'Google לא מחובר. אפשר להמשיך ולהוסיף מקורות מאוחר יותר.','discovery.minimum_permissions':'פרטיות לפני הכול.','discovery.drive_file_note':'LISTIA יכולה לראות רק קבצים שבחרת במפורש עבור LISTIA או קבצים ש-LISTIA יצרה. איננו פותחים את כל ה-Drive שלך.','discovery.scan_again':'חיפוש מחדש','discovery.type_property_document':'מסמך נכס','discovery.type_image':'תמונה','discovery.type_video':'וידאו','discovery.type_spreadsheet':'גיליון','discovery.type_folder':'תיקייה','discovery.type_calendar':'יומן','discovery.type_brand_asset':'נכס מותג','discovery.type_other':'אחר','discovery.untitled':'ללא כותרת','discovery.file_selected':'נבחר לייבוא','discovery.file_not_selected':'לא לייבא','discovery.error':'לא הצלחנו להשלים את החיפוש. אפשר לנסות שוב או להמשיך.',
        'dna.step':'הגדרה · 5 מתוך 5','dna.title':'ה-Business DNA שלך מתחיל כאן','dna.subtitle':'ל-LISTIA כבר יש בסיס אמיתי של העסק שלך והיא תמשיך להעשיר אותו מהמלאי ומהפעילות בלי טפסים מיותרים.','dna.business':'עסק','dna.market':'שוק','dna.google':'Google','dna.assets':'חומרים שנמצאו','dna.connected':'מחובר','dna.not_connected':'לא מחובר','dna.continuous_title':'Business DNA מתעדכן כל הזמן.','dna.continuous_body':'אין צורך למלא שאלון ארוך. LISTIA תלמד מהנכסים, המותג, התוכן והתוצאות שלך תוך כדי העבודה.','dna.finish':'אישור וכניסה ל-LISTIA','ready.title':'סביבת העבודה מוכנה','ready.subtitle':'ההגדרה הושלמה. LISTIA יכולה להמשיך ללמוד מהמלאי ומהפעילות שלך.',
        'office.eyebrow':'משרד','office.title':'כל העסק במקום אחד','office.subtitle':'LISTIA מראה מה היא עושה ומה דורש את תשומת לבך.','office.add_material':'מסירת חומרי נכס ל-LISTIA','office.add_material_hint':'PDF, תמונות, וידאו או תיאור. LISTIA עושה את השאר.','office.today_appointments':'פגישות היום','office.opportunities':'הזדמנויות חדשות','office.managed_leads':'לידים שטופלו','office.active_properties':'נכסים פעילים','office.properties':'נכסים','office.properties_hint':'מלאי וחומרים שהתקבלו','office.google_checking':'בודק חיבור…','office.google_connected':'מחובר','office.google_not_connected':'לא מחובר',
        'properties.eyebrow':'נכסים','properties.title':'המלאי שלך','properties.subtitle':'אתה מוסר את החומרים. LISTIA יוצרת את הנכס וממשיכה להשלים את העבודה.','properties.add':'מסירת חומרים ל-LISTIA','properties.empty_title':'הנכס הראשון מתחיל ממה שכבר יש לך.','properties.empty_body':'זה יכול להיות PDF, תמונות, וידאו או תיאור פשוט.','properties.status_material_received':'חומרים התקבלו','properties.status_processing':'LISTIA מכינה','properties.status_ready':'מוכן','properties.status_published':'פורסם','properties.status_archived':'בארכיון','properties.status_error':'דורש בדיקה','properties.no_location':'מיקום לא הוגדר','properties.no_price':'מחיר לא הוגדר','properties.sale':'מכירה','properties.rent':'השכרה',
        'intake.eyebrow':'נכס חדש','intake.title':'תן לי את מה שיש לך','intake.subtitle':'אל תמלא עוד פורטל. העלה את החומרים שכבר יש לך ו-LISTIA תתחיל להכין את הנכס.','intake.files':'PDF, תמונות, וידאו או מחירון','intake.files_hint':'אפשר לבחור כמה קבצים. עד 50MB לכל קובץ.','intake.description':'תיאור או טקסט קיים','intake.optional':'אופציונלי','intake.description_placeholder':'הדבק את כל המידע שיש לך. אין צורך לסדר אותו מראש.','intake.operation':'עסקה','intake.unknown':'לא יודע / עדיין לא','intake.sale':'מכירה','intake.rent':'השכרה','intake.price':'מחיר','intake.currency':'מטבע','intake.commission':'עמלה','intake.commission_placeholder':'לדוגמה 5%','intake.location':'מיקום או אזור','intake.location_placeholder':'לדוגמה הרצליה','intake.postal':'מיקוד','intake.simple_title':'לא חייבים שיהיה הכול.','intake.simple_body':'אם משהו חסר, LISTIA תחלץ אותו מהחומרים או תשאל רק מה שחיוני.','intake.submit':'LISTIA, הכיני את הנכס','intake.free_note':'Free כולל עד 3 נכסים.','intake.files_selected':'{{count}} קבצים נבחרו','intake.uploading':'מעלה {{current}} מתוך {{total}}…',
        'msg.property_material_required':'הוסף לפחות קובץ, תיאור, מחיר או מיקום.','msg.file_too_large':'אחד הקבצים גדול מ-50MB.','msg.file_type_not_allowed':'סוג קובץ זה עדיין אינו נתמך.','msg.property_creating':'מכין את סביבת הנכס…','msg.property_received':'החומרים התקבלו. LISTIA יצרה את הנכס במלאי.','msg.property_partial_upload':'הנכס נוצר אך חלק מהקבצים לא הועלו. אפשר לנסות שוב.','msg.free_property_limit':'Free כולל עד 3 נכסים פעילים. העבר נכס לארכיון כדי לפנות מקום, או החלף מסלול.','msg.properties_load_error':'לא ניתן לטעון את הנכסים.','msg.upload_failed':'לא ניתן להעלות אחד הקבצים.','msg.discovery_loading':'מחפש חומרים…','msg.discovery_completed':'החיפוש הושלם.','msg.discovery_selection_saved':'הבחירה עודכנה.','msg.finishing_onboarding':'מכין את LISTIA…','msg.onboarding_completed':'ההגדרה הושלמה.','msg.workspace_load_error':'לא ניתן לטעון את סביבת העבודה. נסה שוב.','msg.invalid_email':'הזן כתובת דואר אלקטרוני תקינה.','msg.password_min8':'הסיסמה חייבת להכיל לפחות 8 תווים.','msg.password_min8_signup':'השתמש בסיסמה של לפחות 12 תווים.','msg.login_loading':'מתחבר…','msg.login_success':'הכניסה הצליחה.','msg.invalid_login':'דוא״ל או סיסמה שגויים, או שהדוא״ל עדיין לא אושר.','msg.name_required':'הזן את שמך.','msg.terms_required':'יש לאשר את התנאים ומדיניות הפרטיות.','msg.signup_loading':'יוצר חשבון…','msg.account_created':'החשבון נוצר.','msg.account_created_confirm':'החשבון נוצר. בדוק את הדוא״ל כדי לאשר גישה.','msg.sending':'שולח…','msg.recovery_sent':'אם הכתובת קיימת, יישלח קישור לשחזור.','msg.password_mismatch':'הסיסמאות אינן תואמות.','msg.recovery_expired':'קישור השחזור אינו תקף עוד. בקש קישור חדש.','msg.saving':'שומר…','msg.password_updated':'הסיסמה עודכנה.','msg.complete_three_fields':'מלא את שלושת השדות כדי להמשיך.','msg.session_expired':'פג תוקף ההפעלה. התחבר שוב.','msg.workspace_created_load_error':'סביבת העבודה נוצרה אך לא ניתן לטעון אותה. רענן את הדף.','msg.workspace_created':'סביבת העבודה נוצרה.','msg.business_not_found':'לא מצאנו את העסק שלך.','msg.plan_saved':'המסלול נשמר.','msg.google_opening':'פותח את Google…','msg.google_not_ready':'Google עדיין לא מוכן לחיבור.','msg.continuing':'ממשיך…','msg.google_first':'חבר קודם את Google.','msg.google_connected':'Google חובר בהצלחה.','msg.logout':'יצאת מהחשבון.','msg.config_incomplete':'הגדרת הגישה אינה מלאה.','msg.google_connected_return':'Google חובר בהצלחה.','msg.google_cancelled':'חיבור Google בוטל.','msg.google_error':'לא ניתן לחבר את Google.','msg.email_not_confirmed':'אשר את כתובת הדוא״ל לפני שתמשיך.','msg.user_exists':'כבר קיים חשבון עם כתובת זו.','msg.rate_limited':'יותר מדי ניסיונות. המתן מעט ונסה שוב.','msg.generic_error':'אירעה שגיאה. נסה שוב.'
      }
    },
    'zh-CN': {
      html: 'zh-CN', manifest: 'zh-cn', direction: 'ltr', aliases: ['zh','zh-cn','zh-hans','zh-sg'], label: '简体中文',
      strings: {
        'language.label':'选择语言','common.back':'返回','common.show':'显示','common.hide':'隐藏','common.continue':'继续','common.month':'/月','common.your_business':'您的业务','common.your_workspace':'您的工作区','common.connected_account':'已连接账户','common.logout':'退出登录',
        'login.title':'登录','login.subtitle':'登录您的账户以继续。','login.email':'电子邮箱','login.password':'密码','login.email_placeholder':'name@company.com','login.submit':'登录','login.forgot':'忘记密码？','login.no_account':'还没有账户？','login.create_account':'创建账户',
        'signup.eyebrow':'开始','signup.title':'创建账户','signup.subtitle':'我们只需要基本信息来创建您的工作区。','signup.name':'姓名','signup.name_placeholder':'您的姓名','signup.email':'电子邮箱','signup.password':'密码','signup.password_placeholder':'至少 12 个字符','signup.terms':'我接受条款和隐私政策。','signup.submit':'创建我的账户','signup.have_account':'我已有账户',
        'forgot.eyebrow':'恢复','forgot.title':'恢复访问','forgot.subtitle':'我们会发送安全链接用于重置密码。','forgot.email':'电子邮箱','forgot.submit':'发送链接','reset.eyebrow':'安全','reset.title':'新密码','reset.subtitle':'创建新密码以恢复账户。','reset.new_password':'新密码','reset.confirm_password':'确认密码','reset.confirm_placeholder':'再次输入密码','reset.submit':'保存密码',
        'onboarding.step1':'设置 · 1/5','onboarding.title':'介绍一下您的业务','onboarding.subtitle':'LISTIA 将使用这些信息准备您的工作区。','onboarding.business_name':'业务名称','onboarding.business_name_placeholder':'例如 Riviera Realty','onboarding.business_type':'业务类型','onboarding.select_option':'请选择','onboarding.type_advisor':'独立房地产顾问','onboarding.type_agency':'房地产公司 / 经纪商','onboarding.type_developer':'房地产开发商','onboarding.type_other':'其他房地产业务','onboarding.market':'主要城市或市场','onboarding.market_placeholder':'例如 上海',
        'plan.step':'设置 · 2/5','plan.title':'选择开始方式','plan.subtitle':'之后可以更改计划。在这里选择 Pro 或 Premium 不会立即产生费用。','plan.configuring':'设置','plan.free_desc':'最多包含 3 个房源。使用 LISTIA 开始工作，只为您批准的 Gestiones 付费。','plan.pro_desc':'适合希望自动化业务的房地产专业人士。','plan.premium_desc':'包含 2 位用户，并享受最低使用费率。',
        'google.step':'设置 · 3/5','google.title':'连接您的 Google 生态','google.subtitle':'一次连接即可让 LISTIA 从 Drive 和 Calendar 开始。Gmail、联系人、Analytics、YouTube 等服务只会在确有需要时添加。','google.configuring':'设置','google.permissions_title':'LISTIA 从最少权限开始。','google.permissions_body':'我们不会一次请求整个 Google 账户的访问权限。额外权限会按需逐步请求。','google.connect':'连接 Google','google.skip':'暂不',
        'checkpoint.step':'设置 · 4/5','checkpoint.title':'我们找到了您已有的内容','checkpoint.subtitle':'LISTIA 只查看您已授权的来源，以发现资料和房源，无需从头开始。','checkpoint.account':'✓ LISTIA 账户','checkpoint.business':'✓ 业务','checkpoint.plan':'✓ 已选择计划','checkpoint.google_checking':'Google：检查连接…','checkpoint.google_connected':'✓ Google 已连接','checkpoint.google_not_connected':'Google 未连接',
        'discovery.title':'发现 / 导入','discovery.subtitle':'从您已经授权的来源开始。','discovery.waiting':'准备中','discovery.scanning':'搜索中…','discovery.ready':'就绪','discovery.calendar_checking':'Calendar…','discovery.calendar_ready':'✓ Calendar 就绪','discovery.calendar_none':'Calendar 等待中','discovery.loading':'LISTIA 正在检查当前权限下可访问的内容…','discovery.summary_found':'在 Drive 中找到 {{count}} 个可访问文件。已预选；取消您不想导入的文件。','discovery.summary_none':'当前最小权限下没有可见的 Drive 文件。您可以不导入任何内容继续。','discovery.summary_no_google':'Google 尚未连接。您可以继续并稍后添加来源。','discovery.minimum_permissions':'隐私优先。','discovery.drive_file_note':'LISTIA 只能看到您明确选择给 LISTIA 的文件或 LISTIA 创建的文件。我们不会打开您的整个 Drive。','discovery.scan_again':'重新搜索','discovery.type_property_document':'房产文件','discovery.type_image':'图片','discovery.type_video':'视频','discovery.type_spreadsheet':'电子表格','discovery.type_folder':'文件夹','discovery.type_calendar':'日历','discovery.type_brand_asset':'品牌资料','discovery.type_other':'其他','discovery.untitled':'无标题','discovery.file_selected':'已选择导入','discovery.file_not_selected':'不导入','discovery.error':'无法完成搜索。您可以重试或继续。',
        'dna.step':'设置 · 5/5','dna.title':'您的 Business DNA 从这里开始','dna.subtitle':'LISTIA 已经拥有您业务的真实基础，并会随着房源和业务活动持续丰富，无需填写冗长表单。','dna.business':'业务','dna.market':'市场','dna.google':'Google','dna.assets':'发现的资料','dna.connected':'已连接','dna.not_connected':'未连接','dna.continuous_title':'Business DNA 会持续更新。','dna.continuous_body':'现在无需填写长问卷。LISTIA 会在您工作时从房源、品牌、内容和结果中学习。','dna.finish':'确认并进入 LISTIA','ready.title':'您的工作区已准备就绪','ready.subtitle':'设置完成。LISTIA 可以继续从您的房源和业务活动中学习。',
        'office.eyebrow':'办公室','office.title':'您的业务，集中在一个地方','office.subtitle':'LISTIA 会显示它正在做什么，以及哪些事项需要您的关注。','office.add_material':'向 LISTIA 提供房产资料','office.add_material_hint':'PDF、照片、视频或描述。其余交给 LISTIA。','office.today_appointments':'今日预约','office.opportunities':'新机会','office.managed_leads':'已处理线索','office.active_properties':'活跃房源','office.properties':'房源','office.properties_hint':'房源库存和已接收资料','office.google_checking':'检查连接…','office.google_connected':'已连接','office.google_not_connected':'未连接',
        'properties.eyebrow':'房源','properties.title':'您的房源库存','properties.subtitle':'您提供资料，LISTIA 创建房源并继续完成后续工作。','properties.add':'向 LISTIA 提供资料','properties.empty_title':'第一个房源从您已有的资料开始。','properties.empty_body':'可以是 PDF、照片、视频或简单描述。','properties.status_material_received':'已收到资料','properties.status_processing':'LISTIA 准备中','properties.status_ready':'就绪','properties.status_published':'已发布','properties.status_archived':'已归档','properties.status_error':'需要检查','properties.no_location':'待确定位置','properties.no_price':'待确定价格','properties.sale':'出售','properties.rent':'出租',
        'intake.eyebrow':'新房源','intake.title':'把您已有的资料给我','intake.subtitle':'无需再填写另一个门户。上传已有资料，LISTIA 就会开始准备房源。','intake.files':'PDF、照片、视频或价格表','intake.files_hint':'可以选择多个文件。每个文件最大 50MB。','intake.description':'已有描述或文字','intake.optional':'可选','intake.description_placeholder':'粘贴您已有的所有信息，无需预先整理。','intake.operation':'交易类型','intake.unknown':'不知道 / 暂未确定','intake.sale':'出售','intake.rent':'出租','intake.price':'价格','intake.currency':'货币','intake.commission':'佣金','intake.commission_placeholder':'例如 5%','intake.location':'位置或区域','intake.location_placeholder':'例如 上海浦东','intake.postal':'邮政编码','intake.simple_title':'不需要所有资料都齐全。','intake.simple_body':'如果缺少信息，LISTIA 会从材料中提取，或只询问必要内容。','intake.submit':'LISTIA，准备这个房源','intake.free_note':'Free 最多包含 3 个房源。','intake.files_selected':'已选择 {{count}} 个文件','intake.uploading':'正在上传 {{current}} / {{total}}…',
        'msg.property_material_required':'请至少添加文件、描述、价格或位置中的一项。','msg.file_too_large':'其中一个文件超过 50MB。','msg.file_type_not_allowed':'暂不支持此文件类型。','msg.property_creating':'正在准备房源空间…','msg.property_received':'资料已收到。LISTIA 已在您的库存中创建房源。','msg.property_partial_upload':'房源已创建，但部分文件上传失败。您可以重试。','msg.free_property_limit':'Free 最多包含 3 个活跃房源。归档一个房源可释放名额，也可以稍后更改计划。','msg.properties_load_error':'无法加载房源。','msg.upload_failed':'其中一个文件上传失败。','msg.discovery_loading':'正在搜索资料…','msg.discovery_completed':'搜索完成。','msg.discovery_selection_saved':'选择已更新。','msg.finishing_onboarding':'正在准备 LISTIA…','msg.onboarding_completed':'设置完成。','msg.workspace_load_error':'无法加载工作区。请重试。','msg.invalid_email':'请输入有效的电子邮箱。','msg.password_min8':'密码至少需要 8 个字符。','msg.password_min8_signup':'请使用至少 12 个字符的密码。','msg.login_loading':'正在登录…','msg.login_success':'登录成功。','msg.invalid_login':'邮箱或密码错误，或者邮箱尚未确认。','msg.name_required':'请输入姓名。','msg.terms_required':'您必须接受条款和隐私政策。','msg.signup_loading':'正在创建账户…','msg.account_created':'账户已创建。','msg.account_created_confirm':'账户已创建。请查看电子邮件确认访问。','msg.sending':'正在发送…','msg.recovery_sent':'如果邮箱存在，您将收到恢复链接。','msg.password_mismatch':'两次密码不一致。','msg.recovery_expired':'恢复链接已失效。请重新申请。','msg.saving':'正在保存…','msg.password_updated':'密码已更新。','msg.complete_three_fields':'请填写全部三个字段后继续。','msg.session_expired':'会话已过期。请重新登录。','msg.workspace_created_load_error':'工作区已创建，但无法加载。请刷新页面。','msg.workspace_created':'工作区已创建。','msg.business_not_found':'未找到您的业务。','msg.plan_saved':'计划已保存。','msg.google_opening':'正在打开 Google…','msg.google_not_ready':'Google 尚未准备好连接。','msg.continuing':'继续中…','msg.google_first':'请先连接 Google。','msg.google_connected':'Google 已成功连接。','msg.logout':'已退出登录。','msg.config_incomplete':'访问配置不完整。','msg.google_connected_return':'Google 已成功连接。','msg.google_cancelled':'Google 连接已取消。','msg.google_error':'无法连接 Google。','msg.email_not_confirmed':'继续前请确认电子邮箱。','msg.user_exists':'该邮箱已有账户。','msg.rate_limited':'尝试次数过多。请稍候再试。','msg.generic_error':'发生错误。请重试。'
      }
    }
  };

  const CUSTOM_KEYS = Object.keys(EXTRA);
  let customLanguage = null;

  function normalizeCustom(value) {
    const code = String(value || '').trim().toLowerCase().replaceAll('_','-');
    if (!code) return null;
    for (const [key, cfg] of Object.entries(EXTRA)) {
      if (cfg.aliases.includes(code)) return key;
      if (cfg.aliases.includes(code.split('-')[0])) return key;
    }
    return null;
  }

  function interpolate(value, vars={}) {
    return Object.entries(vars).reduce((text,[key,val]) => text.replaceAll(`{{${key}}}`, String(val)), String(value));
  }

  function persist(language) {
    try { localStorage.setItem('listia_language', language); } catch {}
    document.cookie = `listia_lang=${encodeURIComponent(language)};path=/;max-age=31536000;SameSite=Lax`;
  }

  function ensureOptions() {
    const selector = document.getElementById('languageSelect');
    if (!selector) return;
    for (const key of CUSTOM_KEYS) {
      if (selector.querySelector(`option[value="${key}"]`)) continue;
      const option = document.createElement('option');
      option.value = key;
      option.textContent = EXTRA[key].label;
      selector.append(option);
    }
  }

  function applyCustom(language, original) {
    const cfg = EXTRA[language];
    if (!cfg) return false;
    customLanguage = language;
    document.documentElement.lang = cfg.html;
    document.documentElement.dir = cfg.direction;
    document.documentElement.dataset.listiaLanguage = language;
    ensureOptions();
    const selector = document.getElementById('languageSelect');
    if (selector) {
      selector.value = language;
      selector.setAttribute('aria-label', cfg.strings['language.label']);
      selector.title = cfg.strings['language.label'];
    }
    const translate = (key, vars={}) => interpolate(cfg.strings[key] ?? original.t(key, vars), vars);
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = translate(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.setAttribute('placeholder', translate(el.dataset.i18nPlaceholder)); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', translate(el.dataset.i18nAria)); });
    const manifest = document.getElementById('appManifest');
    if (manifest) manifest.setAttribute('href', `/manifest-${cfg.manifest}.webmanifest?v=1`);
    window.dispatchEvent(new CustomEvent('listia:languagechange', { detail:{language,htmlLanguage:cfg.html,direction:cfg.direction} }));
    return true;
  }

  function patch() {
    const api = window.LISTIA_I18N;
    if (!api || api.__listiaGlobalLocalesPatched) return false;
    const original = {
      t: api.t.bind(api),
      getLanguage: api.getLanguage.bind(api),
      setLanguage: api.setLanguage.bind(api),
      applyTranslations: api.applyTranslations.bind(api),
      normalizeLanguage: api.normalizeLanguage.bind(api)
    };
    api.normalizeLanguage = (value) => normalizeCustom(value) || original.normalizeLanguage(value);
    api.getLanguage = () => customLanguage || original.getLanguage();
    api.t = (key, vars={}) => {
      if (!customLanguage) return original.t(key, vars);
      const cfg = EXTRA[customLanguage];
      return interpolate(cfg.strings[key] ?? original.t(key, vars), vars);
    };
    api.applyTranslations = () => customLanguage ? applyCustom(customLanguage, original) : original.applyTranslations();
    api.setLanguage = (value, options={}) => {
      const custom = normalizeCustom(value);
      if (custom) {
        if (options.persist !== false) persist(custom);
        applyCustom(custom, original);
        return custom;
      }
      customLanguage = null;
      return original.setLanguage(value, options);
    };
    api.supported = [...new Set([...(api.supported || []), ...CUSTOM_KEYS])];
    api.__listiaGlobalLocalesPatched = true;
    ensureOptions();

    let initial = null;
    try {
      initial = normalizeCustom(new URLSearchParams(location.search).get('lang'));
      if (!initial) {
        const match = document.cookie.match(/(?:^|;\s*)listia_lang=([^;]+)/);
        if (match) initial = normalizeCustom(decodeURIComponent(match[1]));
      }
      if (!initial) initial = normalizeCustom(localStorage.getItem('listia_language'));
    } catch {}
    if (!initial) {
      for (const candidate of (navigator.languages?.length ? navigator.languages : [navigator.language])) {
        initial = normalizeCustom(candidate);
        if (initial) break;
      }
    }
    if (initial) applyCustom(initial, original);
    return true;
  }

  const readability = document.createElement('link');
  readability.rel = 'stylesheet';
  readability.href = '/readability.css?v=1';
  readability.dataset.listiaReadability = '1';
  if (!document.querySelector('link[data-listia-readability]')) document.head.append(readability);

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (patch() || attempts > 200) clearInterval(timer);
  }, 25);
  document.addEventListener('DOMContentLoaded', () => { patch(); ensureOptions(); }, {once:true});
})();
