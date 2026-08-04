// הגדרות המדריכים וכללי שדות החובה — משימה ת.0. ר' tools/validate.js.
'use strict';

// ---------------------------------------------------------------------------
// הגדרות המדריכים
// ---------------------------------------------------------------------------

const GUIDES = [
  { id: 'people',        label: 'אישים',      file: 'guides/people/data/people-data.js' },
  { id: 'places',        label: 'מקומות',     file: 'guides/places/data/places.js' },
  { id: 'animal',        label: 'בעלי חיים',  file: 'guides/animal/data/animal-data.js' },
  { id: 'flora',         label: 'צומח',       file: 'guides/flora/data/flora-data.js' },
  { id: 'domem',         label: 'דומם',       file: 'guides/domem/data/domem-data.js' },
  { id: 'beithamikdash', label: 'בית המקדש',  file: 'guides/beithamikdash/data/beithamikdash-data.js' },
];

// שדות החובה נגזרו מהדאטה עצמו: שדה נחשב חובה אם הוא מלא ב-100% מהרשומות של אותה
// קטגוריה נכון לגרסה 2.11.3. שדה שחסר בחלק מהרשומות נרשם כ-recommended ומדווח
// בנפרד כ"חסר מומלץ" — כדי שאפשר יהיה להבחין בין שבירה אמיתית לבין השלמה רצויה.
const FIELD_RULES = {
  people:        { required: ['name', 'cat', 'gender', 'verses'], recommended: ['roles'] },
  places:        { required: ['name', 'cat', 'methods'],          recommended: ['verses'] },
  animal:        { required: ['name', 'cat', 'k', 'methods'],     recommended: ['verses', 'midrash'] },
  flora:         { required: ['name', 'cat', 'methods', 'verses'], recommended: [] },
  domem:         { required: ['name', 'cat', 'explanation', 'identification', 'makorot'], recommended: [] },
  beithamikdash: { required: ['name', 'cat', 'methods'],          recommended: ['verses'] },
};


module.exports = { GUIDES, FIELD_RULES };
