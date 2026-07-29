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

describe('booking mapper staff visibility', () => {
    const staffUser = {
        _id: '507f1f77bcf86cd799439012',
        full_name: 'Lê Quốc Bảo',
        email: 'bao.staff@example.com',
        phone: '0900000004',
        avatar_url: 'https://example.com/avatar.jpg',
        role: 'STAFF',
        is_active: true,
    };
    const staffProfile = {
        _id: '507f1f77bcf86cd799439013',
        user_id: staffUser,
        staff_code: 'CARE-GAR001-01',
        staff_type: 'VEHICLE_CARE_STAFF',
        garage_id: '507f1f77bcf86cd799439014',
        is_active: true,
    };
    const booking = {
        _id: '507f1f77bcf86cd799439011',
        garage_id: {
            _id: '507f1f77bcf86cd799439014',
            name: 'Carivo Quận 1',
            phone: '02812345678',
        },
        booking_items: [{
            item_key: 'CARE_1',
            assigned_care_staff: [{
                staff_profile_id: staffProfile,
                user_id: staffUser,
                released_at: null,
            }],
        }],
    };

    it('keeps staff contact for internal booking responses', () => {
        const result = BookingMapper.toBookingDto(booking);
        const assignment = result.booking_items[0].assigned_care_staff[0];

        expect(assignment.user).toMatchObject({
            full_name: 'Lê Quốc Bảo',
            email: 'bao.staff@example.com',
            phone: '0900000004',
        });
        expect(result.garage.phone).toBe('02812345678');
    });

    it('keeps staff identity but removes personal contact for customer responses', () => {
        const result = BookingMapper.toBookingDto(booking, {
            includeStaffContact: false,
        });
        const assignment = result.booking_items[0].assigned_care_staff[0];

        expect(assignment.user).toMatchObject({
            id: staffUser._id,
            full_name: 'Lê Quốc Bảo',
            avatar_url: 'https://example.com/avatar.jpg',
        });
        expect(assignment.user).not.toHaveProperty('email');
        expect(assignment.user).not.toHaveProperty('phone');
        expect(assignment.staff_profile.user).not.toHaveProperty('email');
        expect(assignment.staff_profile.user).not.toHaveProperty('phone');
        expect(result.garage.phone).toBe('02812345678');
    });
});
