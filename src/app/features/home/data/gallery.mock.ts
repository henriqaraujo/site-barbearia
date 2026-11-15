import { GalleryImage } from '../../../core/models/gallery-image.model';

export const GALLERY_IMAGES: readonly GalleryImage[] = [
  {
    id: 'entrada',
    category: 'Entrada',
    alt: 'Entrada',
    imageUrl: '/assets/fotos/placeholder-ambiente.svg',
    size: 'wide'
  },
  {
    id: 'cadeiras',
    category: 'Cadeiras',
    alt: 'Área de atendimento',
    imageUrl: '/assets/fotos/placeholder-ambiente.svg',
    size: 'tall'
  },
  {
    id: 'recepcao',
    category: 'Recepção',
    alt: 'Recepção',
    imageUrl: '/assets/fotos/placeholder-ambiente.svg',
    size: 'regular'
  },
  {
    id: 'salao',
    category: 'Salão',
    alt: 'Salão principal',
    imageUrl: '/assets/fotos/placeholder-ambiente.svg',
    size: 'wide'
  },
  {
    id: 'frigobar',
    category: 'Conforto',
    alt: 'Área de conforto',
    imageUrl: '/assets/fotos/placeholder-ambiente.svg',
    size: 'regular'
  }
];
