
import { describe, it, expect } from 'vitest';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import data from '@/lib/placeholder-images.json';

describe('PlaceHolderImages', () => {
  it('should be an array', () => {
    expect(Array.isArray(PlaceHolderImages)).toBe(true);
  });

  it('should have the same length as the data in the JSON file', () => {
    expect(PlaceHolderImages.length).toBe(data.placeholderImages.length);
  });

  it('should contain objects with the correct properties', () => {
    if (PlaceHolderImages.length > 0) {
      const firstImage = PlaceHolderImages[0];
      expect(firstImage).toHaveProperty('id');
      expect(firstImage).toHaveProperty('description');
      expect(firstImage).toHaveProperty('imageUrl');
      expect(firstImage).toHaveProperty('imageHint');
    }
  });

  it('should contain the correct data from the JSON file', () => {
    expect(PlaceHolderImages).toEqual(data.placeholderImages);
  });
});
