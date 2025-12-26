// ==========================================
// INTERVALS.ICU API CLIENT
// Core HTTP layer for Intervals.icu API
// ==========================================

/**
 * Creates Basic Auth header for Intervals.icu
 * @param {string} apiKey - API Key
 * @returns {string} Base64 encoded auth string
 */
function createAuthHeader(apiKey) {
    return btoa(`API_KEY:${apiKey}`);
}

/**
 * Uploads an array of events to Intervals.icu using the bulk endpoint.
 * @param {string} apiKey - User API Key
 * @param {string} athleteId - User Athlete ID
 * @param {Array} events - Array of event objects
 * @returns {Promise<Object>} - API Response
 */
async function uploadEventsBulk(apiKey, athleteId, events) {
    if (!events || events.length === 0) return;

    const auth = createAuthHeader(apiKey);
    console.log(`[IntervalsAPI] Uploading ${events.length} events in bulk...`);

    const response = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/events/bulk?upsert=true`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(events)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[IntervalsAPI] Bulk Upload Error:', errorText);
        throw new Error(`Bulk Upload Failed: ${response.status} - ${errorText}`);
    }

    // Handle possible empty body (200 OK or 204 No Content)
    const text = await response.text();
    if (!text || text.trim().length === 0) {
        return { success: true, message: "No content returned" };
    }

    try {
        return JSON.parse(text);
    } catch (e) {
        console.warn("[IntervalsAPI] Bulk Upload: Response was not JSON:", text);
        return { success: true, raw: text };
    }
}

/**
 * Deletes an array of events sequentially to avoid rate limits.
 * @param {string} apiKey - User API Key
 * @param {string} athleteId - User Athlete ID
 * @param {Array} events - Array of event objects (must have 'id')
 */
async function deleteEventsSequential(apiKey, athleteId, events) {
    if (!events || events.length === 0) return;

    const auth = createAuthHeader(apiKey);
    console.log(`[IntervalsAPI] Deleting ${events.length} events sequentially...`);

    for (const event of events) {
        try {
            await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/events/${event.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Basic ${auth}` }
            });
        } catch (e) {
            console.warn(`[IntervalsAPI] Failed to delete event ${event.id}:`, e);
            // Continue deleting others even if one fails
        }
    }
}

/**
 * Fetches events for a date range
 * @param {string} apiKey - API Key
 * @param {string} athleteId - Athlete ID
 * @param {string} oldest - Start date YYYY-MM-DD
 * @param {string} newest - End date YYYY-MM-DD
 * @param {string} category - Optional category filter (e.g., 'TARGET', 'WORKOUT')
 * @returns {Promise<Array>} Array of events
 */
async function fetchEvents(apiKey, athleteId, oldest, newest, category = null) {
    const auth = createAuthHeader(apiKey);
    let url = `https://intervals.icu/api/v1/athlete/${athleteId}/events?oldest=${oldest}&newest=${newest}`;
    if (category) url += `&category=${category}`;

    const res = await fetch(url, {
        headers: { 'Authorization': `Basic ${auth}` }
    });

    if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);
    return await res.json();
}

/**
 * Fetches athlete settings from Intervals.icu
 * @param {string} apiKey - API Key
 * @param {string} athleteId - Athlete ID
 * @returns {Promise<Object>} Athlete data
 */
async function fetchAthlete(apiKey, athleteId) {
    const auth = createAuthHeader(apiKey);
    const res = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}`, {
        headers: { 'Authorization': `Basic ${auth}` }
    });

    if (!res.ok) throw new Error(`Athlete fetch failed: ${res.status}`);
    return await res.json();
}

/**
 * Fetches wellness data for a date range
 * @param {string} apiKey - API Key
 * @param {string} athleteId - Athlete ID
 * @param {string} oldest - Start date YYYY-MM-DD
 * @param {string} newest - End date YYYY-MM-DD
 * @returns {Promise<Array>} Wellness entries
 */
async function fetchWellnessData(apiKey, athleteId, oldest, newest) {
    const auth = createAuthHeader(apiKey);
    const res = await fetch(
        `https://intervals.icu/api/v1/athlete/${athleteId}/wellness?oldest=${oldest}&newest=${newest}`,
        { headers: { 'Authorization': `Basic ${auth}` } }
    );

    if (res.status === 403) {
        console.warn("[IntervalsAPI] 403 Forbidden. Likely missing 'WELLNESS' scope.");
        throw new Error("Wellness access denied. Check API Key permissions.");
    }
    if (!res.ok) throw new Error(`Wellness fetch failed: ${res.status}`);
    return await res.json();
}

/**
 * Fetches activities for a date range
 * @param {string} apiKey - API Key
 * @param {string} athleteId - Athlete ID
 * @param {string} oldest - Start date YYYY-MM-DD
 * @param {string} newest - End date YYYY-MM-DD
 * @returns {Promise<Array>} Activities
 */
async function fetchActivitiesData(apiKey, athleteId, oldest, newest) {
    const auth = createAuthHeader(apiKey);
    const res = await fetch(
        `https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}`,
        { headers: { 'Authorization': `Basic ${auth}` } }
    );

    if (!res.ok) throw new Error(`Activities fetch failed: ${res.status}`);
    return await res.json();
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.IntervalsAPIClient = {
    createAuthHeader,
    uploadEventsBulk,
    deleteEventsSequential,
    fetchEvents,
    fetchAthlete,
    fetchWellnessData,
    fetchActivitiesData
};

// Legacy global exports for direct access
window.uploadEventsBulk = uploadEventsBulk;
window.deleteEventsSequential = deleteEventsSequential;
