// --- CORE FUNCTIONS ---

function timeToSeconds(str) {
    if (!str || typeof str !== 'string' || !str.includes(':')) return 0;
    const [m, s] = str.split(':').map(Number);
    return (m * 60) + s;
}

function secondsToTime(sec) {
    if (!sec || sec === Infinity || sec > 36000) return "--:--";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Calculates the ISO week number for a given date.
 * @param {Date} d - The date to check
 * @returns {number} The ISO week number
 */
function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}
