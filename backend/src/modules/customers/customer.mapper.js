const toId = (value) => {
    if (!value) {
        return null;
    }

    if (value._id) {
        return value._id.toString();
    }

    if (value.toString) {
        return value.toString();
    }

    return value;
};

const toVehicleSuggestionDto = (vehicle = {}) => {
    return {
        id: toId(vehicle._id || vehicle.id),
        license_plate: vehicle.raw_license_plate || vehicle.license_plate || null,
        vehicle_type: vehicle.vehicle_type,
    };
};

const toAdminCustomerSuggestionDto = (customer = {}) => {
    const customerData = customer.customer || {};

    return {
        customer_id: toId(customer.customer_id || customer._id),
        full_name: customerData.full_name || '',
        phone: customerData.phone || null,
        email: customerData.email || null,
        vehicles: (customer.vehicles || []).map((vehicle) => toVehicleSuggestionDto(vehicle)),
        last_booking_at: customer.last_booking_at || null,
        total_bookings_at_garage: customer.total_bookings_at_garage || 0,
    };
};

const toAdminCustomerSuggestionDtoList = (customers = []) => {
    return customers.map((customer) => toAdminCustomerSuggestionDto(customer));
};

module.exports = {
    toAdminCustomerSuggestionDto,
    toAdminCustomerSuggestionDtoList,
};
