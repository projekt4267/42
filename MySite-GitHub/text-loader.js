'use strict';
(async () => {
  try {
    const response = await fetch('./TEXTS.json', {cache:'no-store'});
    if (!response.ok) throw new Error('TEXTS.json: HTTP ' + response.status);
    const content = await response.json();
    const read = key => key.split('.').reduce((value, part) => value && Object.hasOwn(value,part) ? value[part] : undefined, content);
    const requiredStrings = ["главная.вкладка","главная.навигация","главная.логотип_слева","главная.логотип_справа","главная.верхняя_строка","главная.верхняя_подпись","главная.имена","главная.заголовок","главная.заголовок_курсивом","главная.описание_строка_1","главная.описание_строка_2","главная.нижняя_подпись","поддержка.надзаголовок","поддержка.заголовок","поддержка.до_нажатия","поддержка.кнопка","поддержка.кнопка_ещё","кубик.надзаголовок","кубик.заголовок","кубик.выбор_участника","кубик.кнопка_аня","кубик.кнопка_лёша","кубик.до_броска","кубик.кнопка_бросить","кубик.приписка","кубик.после_смены_участника","игра.надзаголовок","игра.название","игра.описание_строка_1","игра.описание_строка_2","игра.кнопка_начать","игра.подпись_карточки","игра.подсказка","игра.кнопка_вернуться","игра.сердечко_для_озвучки","игра.победа","игра.подпись_победы","игра.счётчик","игра.собрано_букетов","желания.надзаголовок_карточки","желания.заголовок_карточки","желания.описание_строка_1","желания.описание_строка_2","желания.кнопка_открыть","желания.подпись_карточки","желания.закрыть","желания.надзаголовок_окна","желания.заголовок_окна","желания.пояснение","желания.поле","желания.пример","желания.подсказка_черновика","желания.куда_сохраняется","желания.подтверждение_заголовок","желания.подтверждение_пояснение","желания.кнопка_дописать","желания.кнопка_сохранить","желания.кнопка_подтвердить","желания.ошибка_черновика","желания.подпись_после_отправки","желания.кнопка_после_отправки","желания.нет_личной_ссылки","желания.уже_сохранено","желания.неверная_ссылка","желания.нет_связи","желания.пустой_список","желания.отправляется","желания.повторная_отправка","желания.успех","желания.ошибка_отправки","желания.счётчик_символов","карта.город_лёши","карта.город_ани","карта.надзаголовок_карточки","карта.название","карта.описание_строка_1","карта.описание_строка_2","карта.закрыть","карта.надзаголовок_окна","карта.заголовок_окна","карта.подпись_лёши","карта.подпись_ани","карта.приблизить","карта.весь_мир","карта.описание_для_озвучки","карта.перед_километрами","карта.под_километрами","карта.пояснение","карта.километры","настройки.название","настройки.надзаголовок","настройки.закрыть","настройки.пояснение","настройки.радиус","настройки.количество","настройки.скорость","настройки.размер","настройки.палитра","настройки.розовый","настройки.лаванда","настройки.яркий","настройки.тёмный_фон","настройки.анимация","настройки.кнопка_сбросить","настройки.сохраняется","настройки.не_сохраняется","настройки.единица_размера"];
    for (const key of requiredStrings) {
      if (typeof read(key) !== 'string') throw new Error('Ожидается текст в поле «' + key + '».');
    }
    for (const key of ['поддержка.фразы','кубик.общие','кубик.для_ани','кубик.для_лёши']) {
      const list = read(key);
      if (!Array.isArray(list) || list.some(item => typeof item !== 'string' || !item.trim())) {
        throw new Error('В «' + key + '» должен быть список непустых текстовых строк.');
      }
    }
    if (!read('поддержка.фразы').length) throw new Error('Добавь хотя бы одну фразу в «поддержка.фразы».');
    for (const person of ['для_ани','для_лёши']) {
      if (!read('кубик.общие').length && !read('кубик.'+person).length) throw new Error('Добавь хотя бы одну идею в «кубик.общие» или «кубик.'+person+'».');
    }
    window.SiteText = {
      get(key, values = {}) {
        const text = read(key);
        if (typeof text !== 'string') throw new Error('Не найден текст: '+key);
        return text.replace(/\{([a-z]+)\}/g, (match,name) => Object.hasOwn(values,name) ? String(values[name]) : match);
      },
      list(key) { return [...read(key)]; }
    };
    for (const element of document.querySelectorAll('[data-text]')) {
      const values = {};
      if (element.hasAttribute('data-text-count')) values.count = element.getAttribute('data-text-count');
      element.textContent = SiteText.get(element.dataset.text, values);
    }
    for (const attribute of ['aria-label','title','placeholder']) {
      for (const element of document.querySelectorAll('[data-text-'+attribute+']')) {
        element.setAttribute(attribute,SiteText.get(element.getAttribute('data-text-'+attribute)));
      }
    }
    // Load behavior only after the editable file has been read and validated.
    for (const source of ['./app.js','./together.js']) {
      await new Promise((resolve,reject) => {
        const script = document.createElement('script');
        script.src = source; script.onload = resolve;
        script.onerror = () => reject(new Error('Не удалось загрузить '+source));
        document.head.append(script);
      });
    }
  } catch (error) {
    const notice = document.createElement('aside');
    notice.className = 'text-load-error'; notice.setAttribute('role','alert');
    const title = document.createElement('strong'); title.textContent = 'Не получилось прочитать файл с текстами';
    const help = document.createElement('p');
    help.textContent = 'Открой TEXTS.json в репозитории, проверь кавычки и запятые, сохрани файл и обнови страницу. До исправления кнопки не работают.';
    const detail = document.createElement('pre'); detail.textContent = String(error.message);
    notice.append(title,help,detail); document.body.prepend(notice);
    document.querySelectorAll('button').forEach(button => { button.disabled = true; });
  }
})();
