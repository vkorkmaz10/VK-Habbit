export const CHECKBOX_ITEMS = [
  { id: 'kahvalti', label: 'Kahvaltı', emoji: '🍳' },
  { id: 'whey', label: 'Whey', emoji: '🥤' },
  { id: 'ana_ogun', label: 'Ana Öğün', emoji: '🥩' },
  { id: 'aksam_yemi', label: 'Akşam Yemeği', emoji: '🍽️' },
  { id: 'gece_ogun', label: 'Gece Öğünü', emoji: '🥣' },
  { id: 'su', label: 'Su (2 Lt)', emoji: '💧' },
  { id: 'kreatin', label: 'Kreatin', emoji: '💊' },
  { id: 'uyku', label: 'Uyku (7+)', emoji: '💤' },
  { id: 'antrenman', label: 'Antrenman', emoji: '🏋️‍♂️' },
  { id: 'agirlik_artis', label: 'Ağırlık Artışı', emoji: '📈' },
  { id: 'karin', label: 'Karın (Kas)', emoji: '🍫' },
  { id: 'kardiyo', label: 'Adım/Kardiyo', emoji: '🏃‍♂️' }
];

// Returns empty default checks array:
export const getDefaultChecks = () => Array(CHECKBOX_ITEMS.length).fill(0);
