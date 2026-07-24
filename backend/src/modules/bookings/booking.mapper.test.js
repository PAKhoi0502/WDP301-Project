const BookingMapper = require('./booking.mapper');

describe('booking mapper handover summary', () => {
    const booking = {
        _id: '507f1f77bcf86cd799439011',
        status: 'COMPLETED',
        payment_status: 'PAID',
    };

    it('omits handover fields when the caller does not request the summary contract', () => {
        const result = BookingMapper.toBookingDto(booking);

        expect(result).not.toHaveProperty('handover_state');
        expect(result).not.toHaveProperty('handover_released_at');
    });

    it('returns nullable handover fields when no handover exists', () => {
        const result = BookingMapper.toBookingDto(booking, { handover: null });

        expect(result).toMatchObject({
            handover_state: null,
            handover_released_at: null,
        });
    });

    it('maps the authoritative release state and timestamp', () => {
        const releasedAt = new Date('2026-07-25T00:00:00.000Z');
        const result = BookingMapper.toBookingDto(booking, {
            handover: {
                state: 'RELEASED',
                released_at: releasedAt,
            },
        });

        expect(result).toMatchObject({
            handover_state: 'RELEASED',
            handover_released_at: releasedAt,
        });
    });
});
