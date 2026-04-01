import { describe, expect, it } from 'vitest';
import { assertDispatchRegistryComplete } from './dispatch.js';

describe('dispatch', () => {
    it('реестр покрывает все значения ClientMsg', () => {
        expect(() => assertDispatchRegistryComplete()).not.toThrow();
    });
});
