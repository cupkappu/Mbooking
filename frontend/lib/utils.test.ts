import { cn } from './utils';

describe('utils', () => {
  describe('cn (class names utility)', () => {
    it('should merge class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('should handle tailwind classes with overlapping styles', () => {
      // twMerge should handle tailwind class conflicts
      const result = cn('p-4 p-2', 'm-2 m-4');
      expect(result).toContain('p-2');
      expect(result).toContain('m-4');
    });

    it('should handle conditional classes (falsy values)', () => {
      const shouldAdd = false;
      const shouldNotAdd = 0;
      expect(cn('base', shouldAdd && 'conditional', shouldNotAdd && 'zero')).toBe('base');
    });

    it('should handle conditional classes (truthy values)', () => {
      const shouldAdd = true;
      expect(cn('base', shouldAdd && 'conditional')).toBe('base conditional');
    });

    it('should handle undefined and null gracefully', () => {
      expect(cn('base', undefined, null, 'end')).toBe('base end');
    });

    it('should handle empty strings', () => {
      expect(cn('base', '', 'end')).toBe('base end');
    });

    it('should handle array of classes', () => {
      expect(cn(['class1', 'class2'])).toBe('class1 class2');
    });

    it('should handle mixed input types', () => {
      const result = cn('base', ['array1', 'array2'], { conditional: true, 'another': true });
      expect(result).toContain('base');
      expect(result).toContain('array1');
      expect(result).toContain('array2');
      expect(result).toContain('conditional');
      expect(result).toContain('another');
    });

    it('should handle object with falsy values', () => {
      const result = cn('base', { truthy: true, falsy: false, nullVal: null, undefinedVal: undefined });
      expect(result).toBe('base truthy');
    });
  });
});
