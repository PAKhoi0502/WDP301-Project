const {
    normalizePhone,
    isValidPhone,
    toSmsPhone,
} = require('./phone');

describe('phone utilities', () => {
    it.each([
        ['0901234567', '+84901234567'],
        ['84901234567', '+84901234567'],
        ['+84901234567', '+84901234567'],
        ['+84 901 234 567', '+84901234567'],
        ['090-123-4567', '+84901234567'],
        ['+12025550123', '+12025550123'],
    ])('normalizes %s to %s', (input, expected) => {
        expect(normalizePhone(input)).toBe(expected);
    });

    it('validates normalized local and international numbers', () => {
        expect(isValidPhone('+84901234567')).toBe(true);
        expect(isValidPhone('+12025550123')).toBe(true);
        expect(isValidPhone('123')).toBe(false);
    });

    it('converts Vietnamese local numbers for SMS delivery', () => {
        expect(toSmsPhone('0901234567')).toBe('+84901234567');
    });
});
