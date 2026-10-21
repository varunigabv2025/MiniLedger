// MiniLedger Palette Tokens
export const colors = {
  // Required 4 Core Colors
  cream: '#F8F4E1',         // Primary screen background, light surfaces, spacious cards
  warmTaupe: '#AF8F6F',     // Secondary surfaces, muted accents, borders, icons
  earthyBrown: '#74512D',   // Primary buttons, secondary headings, active controls
  darkEspresso: '#543310',  // Primary text, prominent headings, key figures, dark feature cards

  // Functional & Semantic Tokens
  background: '#F8F4E1',
  surfaceCardLight: '#FFFFFF',
  surfaceCardCream: '#F3EEDB',
  cardEspresso: '#543310',
  cardEspressoText: '#F8F4E1',
  cardEspressoSub: '#D6C7B2',

  // Status indicators (Restrained & Accompanied by Text Labels)
  statusOverdue: '#9C0006',
  statusOverdueBg: '#FFDAD6',
  statusOverdueBorder: '#FFB4AB',

  statusRepaid: '#1B5E20',
  statusRepaidBg: '#E8F5E9',
  statusRepaidBorder: '#C8E6C9',

  statusPending: '#74512D',
  statusPendingBg: '#EDE4D5',
  statusPendingBorder: '#D8C7B5',

  // Form & Utility
  border: '#E3D7C5',
  borderFocus: '#74512D',
  disabled: '#C4B5A5',
  placeholder: '#9E8873',
  inputBg: '#FFFFFF',
  white: '#FFFFFF',
  shadowColor: '#543310',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 20,
  round: 9999,
};

export const shadows = {
  card: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHighlight: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
};
