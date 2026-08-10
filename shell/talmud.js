// "ציורים וכלי עזר" (מפרט 4.0, ב.3) — עמוד המסכתות: כרטיס לכל אחת מ-63 המסכתות,
// לפי סדר המשנה. זו לא רשימה נפרדת מ"כלי העזר" — היא כלי העזר, ממוינים לפי סדר
// המסכתות: מסכת עם כלי עזר מוטמע פותחת אותו בלחיצה, מסכת בלי — placeholder.
// לשעבר "משנה ותלמוד" (סבב 1); רשימת המסכתות עצמה כבר לא נכתבת כאן — נגזרת
// מ-MISHNA_MASECHTOT (shell/shas.js), ששם גם בורר המסכת של שערי משנה/בבלי.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.
// טוען אחרי guides.js (landing/frameWrap/guideFrame/frameTitle/closeFrame משם).

const MASECHTOT_SEDARIM = SEDER_ORDER.map(seder => ({
  seder: seder,
  list: MISHNA_MASECHTOT.filter(m => m.seder === seder).map(m => m.name),
}));

// שלושת כלי העזר הקיימים, משובצים במסכת שלהם (מפרט 4.0, ב.3) במקום במדור נפרד.
// נפתחים כדף עצמאי בפריים הקיים (guideFrame, כמו openCustomHtmlPage ב-home.js),
// דרך src אמיתי ולא srcdoc: כך הקבצים (script.js/style.css/diagrams.js) נטענים
// ישירות מהדיסק, בלי לעבור דרך storage/טעינת-טקסט - פחות טוקנים וזיכרון גם בעתיד.
const MASECHET_TOOLS = {
  'חולין': { title: 'תוסף חולין', path: 'guides/talmud-tools/chullin/index.html', icon: 'icon/masechtot/chullin.png' },
  'בכורות': { title: 'תוסף מומים — מסכת בכורות', path: 'guides/talmud-tools/mumim-bechorot/index.html', icon: 'icon/masechtot/bechorot.png' },
  'סוכה': { title: 'תוסף סוכה ולולב', path: 'guides/talmud-tools/sukkah-lulav/index.html', icon: 'icon/masechtot/sukkah.png' },
};

const talmudView = document.getElementById('talmudView');
const talmudMasechtotGrid = document.getElementById('talmudMasechtotGrid');
let talmudRendered = false;

function openExternalGuide(path, title){
  guideFrame.removeAttribute('srcdoc');
  guideFrame.src = path;
  frameTitle.textContent = title;
  frameWrap.classList.add('open');
}

// אין איקון מוכן למסכת = האיקון הראשי של אוצריא (מפרט 4.0, ב.4) — לא אמוג'י, לא המצאה.
function masechetCardHtml(name){
  const tool = MASECHET_TOOLS[name];
  const icon = (tool && tool.icon) || 'icon/icon.png';
  const badge = tool ? '<span class="talmud-tool-badge">גרסה ראשונית</span>' : '';
  return `<div class="card" data-masechet="${esc(name)}">` +
    `<img class="icon-img" src="${esc(icon)}" alt="" onerror="this.src='icon/icon.png'">` +
    `<span class="label">${esc(name)}${badge}</span></div>`;
}

function renderMasechtot(){
  talmudMasechtotGrid.innerHTML = MASECHTOT_SEDARIM.map(s => `
      <h3 class="masechet-seder-head">סדר ${esc(s.seder)}</h3>
      <div class="cards masechtot-grid">
        ${s.list.map(masechetCardHtml).join('')}
      </div>
    `).join('');
  talmudMasechtotGrid.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => {
      const name = el.dataset.masechet;
      const tool = MASECHET_TOOLS[name];
      if (tool) openExternalGuide(tool.path, tool.title);
      else window.alert('מסכת ' + name + ' — בחירת דף ותוכן יתאפשרו בעדכון עתידי.');
    });
  });
}

function openTalmudView(){
  landing.style.display = 'none';
  frameWrap.classList.remove('open');
  if (!talmudRendered){ renderMasechtot(); talmudRendered = true; }
  talmudView.classList.add('open');
}
function closeTalmudView(){
  talmudView.classList.remove('open');
  landing.style.display = '';
}

document.getElementById('talmudCard').addEventListener('click', openTalmudView);
document.getElementById('talmudBackBtn').addEventListener('click', closeTalmudView);
