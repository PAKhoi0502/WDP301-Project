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

const toUserSummaryDto = (user) => {
    if (!user || typeof user !== 'object' || !user._id) {
        return null;
    }

    const plainUser = user.toObject ? user.toObject() : user;

    return {
        id: plainUser._id?.toString() || plainUser.id || null,
        full_name: plainUser.full_name || '',
        email: plainUser.email || null,
        phone: plainUser.phone || null,
        role: plainUser.role,
        is_active: plainUser.is_active,
    };
};

const toUploadDto = (upload) => {
    if (!upload) {
        return null;
    }

    const plainUpload = upload.toObject ? upload.toObject() : upload;

    return {
        id: plainUpload._id?.toString() || plainUpload.id || null,
        url: plainUpload.url,
        public_id: plainUpload.public_id,
        mime_type: plainUpload.mime_type,
        size: plainUpload.size,
        purpose: plainUpload.purpose,
        owner_id: toId(plainUpload.owner_id),
        owner: toUserSummaryDto(plainUpload.owner_id),
        related_type: plainUpload.related_type,
        related_id: toId(plainUpload.related_id),
        created_at: plainUpload.created_at,
        updated_at: plainUpload.updated_at,
    };
};

const toUploadDtoList = (uploads = []) => {
    return uploads.map((upload) => toUploadDto(upload));
};

module.exports = {
    toUploadDto,
    toUploadDtoList,
};
