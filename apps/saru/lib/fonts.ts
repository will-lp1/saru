import { Playfair_Display, Lora, Montserrat, Poppins, Fira_Code, Crimson_Text, Inter } from 'next/font/google';

export const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

export const crimson = Crimson_Text({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

export const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

export const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

export const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

export const firacode = Fira_Code({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
});

export const googleFonts = {
  playfair,
  lora,
  montserrat,
  poppins,
  firacode,
  inter,
  crimson,  
} as const;

export type FontOption = keyof typeof googleFonts; 