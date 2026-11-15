/**
 * Contraste de texto sobre as cores da marca (WCAG 2.x). O texto sobre uma cor da empresa e sempre o claro ou o
 * escuro do site (o "branco" e o "preto" da paleta), o que tiver mais contraste; o minimo AA para texto normal e 4.5:1.
 */
export const LIGHT_TEXT_COLOR = '#f3f0e8';
export const DARK_TEXT_COLOR = '#0a0a0a';
export const WCAG_AA_NORMAL_TEXT = 4.5;

export interface ReadableTextColor {
  readonly color: string;
  /** Contraste entre a cor escolhida e o fundo, arredondado a duas casas. */
  readonly ratio: number;
  readonly meetsAA: boolean;
}

/** Luminancia relativa de uma cor #rrggbb (WCAG). */
export function relativeLuminance(hexColor: string): number {
  const [red, green, blue] = [1, 3, 5].map((start) => toLinear(parseInt(hexColor.slice(start, start + 2), 16) / 255));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** Razao de contraste entre duas cores #rrggbb, de 1 a 21. */
export function contrastRatio(firstColor: string, secondColor: string): number {
  const [lighter, darker] = [relativeLuminance(firstColor), relativeLuminance(secondColor)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Texto claro ou escuro, o de maior contraste sobre o fundo, e se ele atinge o AA. */
export function readableTextColor(backgroundColor: string): ReadableTextColor {
  const lightRatio = contrastRatio(backgroundColor, LIGHT_TEXT_COLOR);
  const darkRatio = contrastRatio(backgroundColor, DARK_TEXT_COLOR);
  const [color, ratio] = lightRatio >= darkRatio ? [LIGHT_TEXT_COLOR, lightRatio] : [DARK_TEXT_COLOR, darkRatio];

  return { color, ratio: Math.round(ratio * 100) / 100, meetsAA: ratio >= WCAG_AA_NORMAL_TEXT };
}

function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}
