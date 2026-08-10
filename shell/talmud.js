// "משנה ותלמוד" — עמוד רשימת מסכתות + מדריכים וכלי עזר. נוצר בסבב 1.
// בחירת דף בתוך מסכת ("מה יש בדף") נדחית לסבב הבא — כרגע כרטיס-מסכת הוא placeholder.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.
// טוען אחרי guides.js (landing/frameWrap/guideFrame/frameTitle/closeFrame משם).

// 63 המסכתות, לפי סדר המשנה (שישה סדרים). נגזרות מ-MISHNA_MASECHTOT (shell/shas.js)
// ולא נכתבות כאן שוב — שתי רשימות של אותם 63 שמות היו נפרדות זו מזו בעריכה הראשונה.
const MASECHTOT_SEDARIM = SEDER_ORDER.map(seder => ({
  seder: seder,
  list: MISHNA_MASECHTOT.filter(m => m.seder === seder).map(m => m.name),
}));

// שלושת התוספים הקיימים שמוצגים כאן כ"גרסה ראשונית" — נפתחים כדף עצמאי בפריים
// הקיים (guideFrame, כמו openCustomHtmlPage ב-home.js), אבל דרך src אמיתי ולא
// srcdoc: כך הקבצים (script.js/style.css/diagrams.js) נטענים ישירות מהדיסק,
// בלי לעבור דרך storage/טעינת-טקסט - פחות טוקנים וזיכרון גם בעתיד.
const TALMUD_TOOLS = [
  { icon: '🥩', title: 'תוסף חולין', path: 'guides/talmud-tools/chullin/index.html' },
  { icon: '🐄', title: 'תוסף מומים — מסכת בכורות', path: 'guides/talmud-tools/mumim-bechorot/index.html' },
  { icon: '🌿', title: 'תוסף סוכה ולולב', path: 'guides/talmud-tools/sukkah-lulav/index.html' },
];

const talmudView = document.getElementById('talmudView');
const talmudToolsGrid = document.getElementById('talmudToolsGrid');
const talmudMasechtotGrid = document.getElementById('talmudMasechtotGrid');
let talmudRendered = false;

function openExternalGuide(path, title){
  guideFrame.removeAttribute('srcdoc');
  guideFrame.src = path;
  frameTitle.textContent = title;
  frameWrap.classList.add('open');
}

function renderTalmudTools(){
  talmudToolsGrid.innerHTML = '';
  TALMUD_TOOLS.forEach(tool => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<span class="icon">${tool.icon}</span><span class="label">${esc(tool.title)}<span class="talmud-tool-badge">גרסה ראשונית</span></span>`;
    card.addEventListener('click', () => openExternalGuide(tool.path, tool.title));
    talmudToolsGrid.appendChild(card);
  });
}

function renderMasechtot(){
  talmudMasechtotGrid.innerHTML = '<div class="cards-sep"><span>מסכתות המשנה והתלמוד</span></div>' +
    MASECHTOT_SEDARIM.map(s => `
      <h3 class="masechet-seder-head">סדר ${esc(s.seder)}</h3>
      <div class="masechtot-grid">
        ${s.list.map(name => `<div class="masechet-card" data-masechet="${esc(name)}">${esc(name)}</div>`).join('')}
      </div>
    `).join('');
  talmudMasechtotGrid.querySelectorAll('.masechet-card').forEach(el => {
    el.addEventListener('click', () => {
      window.alert('מסכת ' + el.dataset.masechet + ' — בחירת דף ותוכן יתאפשרו בעדכון עתידי.');
    });
  });
}

function openTalmudView(){
  landing.style.display = 'none';
  frameWrap.classList.remove('open');
  if (!talmudRendered){ renderTalmudTools(); renderMasechtot(); talmudRendered = true; }
  talmudView.classList.add('open');
}
function closeTalmudView(){
  talmudView.classList.remove('open');
  landing.style.display = '';
}

document.getElementById('talmudCard').addEventListener('click', openTalmudView);
document.getElementById('talmudBackBtn').addEventListener('click', closeTalmudView);
