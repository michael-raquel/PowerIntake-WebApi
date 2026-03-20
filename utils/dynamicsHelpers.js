const axios = require("axios");

const cleanDescription = (text) => {
    if (!text) return null;
    return text
        .replace(/\[cid:[^\]]+\]/g, "")
        .replace(/\[https?:\/\/[^\]]+\]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

const dynamicsHeaders = (token) => ({
    Authorization:      `Bearer ${token}`,
    Accept:             "application/json",
    "OData-Version":    "4.0",
    "OData-MaxVersion": "4.0",
    "Prefer":           "odata.include-annotations=OData.Community.Display.V1.FormattedValue",
});

const resolveTechnicianNames = async (tickets, token) => {
    const technicianIds = [...new Set(
        tickets
            .map(t => t._ss_assignedtechnician_value)
            .filter(Boolean)
    )];

    const technicianMap = {};

    await Promise.all(
        technicianIds.map(async (id) => {
            try {
                const res = await axios.get(
                    `${process.env.DYNAMICS_URL}/api/data/v9.2/systemusers(${id})?$select=fullname`,
                    { headers: dynamicsHeaders(token) }
                );
                technicianMap[id] = res.data.fullname ?? null;
            } catch {
                technicianMap[id] = null;
            }
        })
    );

    return technicianMap;
};

module.exports = { cleanDescription, dynamicsHeaders, resolveTechnicianNames };