const normalizePhone = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    const compactPhone = value.trim().replace(/[\s().-]/g, '');

    if (compactPhone.startsWith('+84')) {
        return compactPhone;
    }

    if (compactPhone.startsWith('84') && !compactPhone.startsWith('840')) {
        return `+${compactPhone}`;
    }

    if (compactPhone.startsWith('0')) {
        return `+84${compactPhone.slice(1)}`;
    }

    return compactPhone;
};

const isValidPhone = (value) => {
    const phone = normalizePhone(value);

    return /^\+[1-9][0-9]{8,14}$/.test(phone);
};

const toSmsPhone = (value) => {
    return normalizePhone(value);
};

module.exports = {
    normalizePhone,
    isValidPhone,
    toSmsPhone,
};
