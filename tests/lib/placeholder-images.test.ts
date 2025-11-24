import { vi, describe, it, expect } from 'vitest';
import { PlaceHolderImages, ImagePlaceholder } from '../../src/lib/placeholder-images';
import data from '../../src/lib/placeholder-images.json';

vi.mock('../../src/lib/placeholder-images.json', () => ({
  default: {
    placeholderImages: [
      {
        id: '1',
        description: 'Test Image 1',
        imageUrl: 'http://example.com/test1.jpg',
        imageHint: 'A test image',
      },
      {
        id: '2',
        description: 'Test Image 2',
        imageUrl: 'http://example.com/test2.jpg',
        imageHint: 'Another test image',
      },
    ],
  },
}));

describe('Placeholder Images', () => {
  it('should load placeholder images from the JSON file', () => {
    expect(PlaceHolderImages).toBeDefined();
    expect(PlaceHolderImages.length).toBe(2);
    expect(PlaceHolderImages[0].id).toBe('1');
    expect(PlaceHolderImages[1].description).toBe('Test Image 2');
  });

  it('should have the correct structure for each placeholder image', () => {
    PlaceHolderImages.forEach((image: ImagePlaceholder) => {
      expect(image).toHaveProperty('id');
      expect(image).toHaveProperty('description');
      expect(image).toHaveProperty('imageUrl');
      expect(image).toHaveProperty('imageHint');
    });
  });

  it('should match the data from the imported JSON file', () => {
    expect(PlaceHolderImages).toEqual(data.placeholderImages);
  });
});