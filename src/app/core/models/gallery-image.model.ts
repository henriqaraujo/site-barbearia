export interface GalleryImage {
  readonly id: string;
  readonly category: string;
  readonly alt: string;
  readonly imageUrl: string;
  readonly size: 'wide' | 'tall' | 'regular';
  /** Asset local usado quando a midia enviada pela empresa nao carrega. */
  readonly fallbackImageUrl?: string;
}
