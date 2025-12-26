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
