
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/lib/placeholder-images.json', () => ({
  default: {
    placeholderImages: [
      {
        id: '1',
        description: 'Test Image 1',
        imageUrl: 'https://example.com/image1.png',
        imageHint: 'A test image',
      },
    ],
  },
}));

import { PlaceHolderImages } from '../../src/lib/placeholder-images';

describe('PlaceHolderImages', () => {
  it('should load placeholder images from the JSON file', () => {
    expect(PlaceHolderImages).toBeInstanceOf(Array);
    expect(PlaceHolderImages.length).toBeGreaterThan(0);
    for (const image of PlaceHolderImages) {
      expect(image).toHaveProperty('id');
      expect(image).toHaveProperty('description');
      expect(image).toHaveProperty('imageUrl');
      expect(image).toHaveProperty('imageHint');
    }
  });
});
