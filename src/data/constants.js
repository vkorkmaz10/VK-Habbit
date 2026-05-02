export const CHECKBOX_ITEMS = [
  { id: 'kahvalti', label: 'Kahvaltı', icon: 'Coffee' },
  { id: 'whey', label: 'Whey', icon: 'Zap' },
  { id: 'ana_ogun', label: 'Ana Öğün', icon: 'UtensilsCrossed' },
  { id: 'aksam_yemi', label: 'Akşam Yemeği', icon: 'Utensils' },
  { id: 'gece_ogun', label: 'Gece Öğünü', icon: 'Moon' },
  { id: 'su', label: 'Su (2 Lt)', icon: 'Droplets' },
  { id: 'kreatin', label: 'Kreatin', icon: 'Pill' },
  { id: 'uyku', label: 'Uyku (7+)', icon: 'BedDouble' },
  { id: 'antrenman', label: 'Antrenman', icon: 'Dumbbell' },
  { id: 'agirlik_artis', label: 'Ağırlık Artışı', icon: 'TrendingUp' },
  { id: 'karin', label: 'Karın (Kas)', icon: 'Target' },
  { id: 'kardiyo', label: 'Adım Hedefi', icon: 'Footprints' },
];

// Returns empty default checks array:
export const getDefaultChecks = () => Array(CHECKBOX_ITEMS.length).fill(0);
