// ==========================================
// MOBILE TODAY VIEW
// "One Glance, No Scroll" mobile experience
// ==========================================

/**
 * Workout type configuration for mobile display
 */
const WORKOUT_DISPLAY = {
    'LongRun': { icon: '🏃‍♂️', color: 'orange', label: 'Long Run', pillIcon: '🏃‍♂️' },
    'Long Run': { icon: '🏃‍♂️', color: 'orange', label: 'Long Run', pillIcon: '🏃‍♂️' },
    'Intervals': { icon: '⚡', color: 'red', label: 'Intervals', pillIcon: '⚡' },
    'Tempo': { icon: '🔥', color: 'amber', label: 'Tempo', pillIcon: '🔥' },
    'Easy': { icon: '🏃', color: 'green', label: 'Easy Run', pillIcon: '🏃' },
    'Easy Run': { icon: '🏃', color: 'green', label: 'Easy Run', pillIcon: '🏃' },
    'Run': { icon: '🏃', color: 'green', label: 'Run', pillIcon: '🏃' },
    'WeightTraining': { icon: '💪', color: 'purple', label: 'Strength', pillIcon: '💪' },
    'Strength': { icon: '💪', color: 'purple', label: 'Strength', pillIcon: '💪' },
    'Yoga': { icon: '🧘', color: 'teal', label: 'Yoga', pillIcon: '🧘' },
    'Rest': { icon: '🛌', color: 'slate', label: 'Rest Day', pillIcon: '🛌' },
    'ActiveRecovery': { icon: '🚶', color: 'emerald', label: 'Recovery', pillIcon: '🚶' },
    'Ride': { icon: '🚴', color: 'blue', label: 'Ride', pillIcon: '🚴' },
    'default': { icon: '📋', color: 'slate', label: 'Workout', pillIcon: '📋' }
};

/**
 * Get today's workout from generated workouts
 * @returns {Object|null} Today's workout or null
 */
function getTodaysWorkout() {
    if (!window.state?.generatedWorkouts) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Search through all weeks for today's workout
    for (const weekIndex in window.state.generatedWorkouts) {
        const workouts = window.state.generatedWorkouts[weekIndex];
        if (!workouts) continue;

        for (const workout of workouts) {
            if (!workout.date) continue;
            const workoutDate = new Date(workout.date);
            const workoutDateStr = workoutDate.toISOString().split('T')[0];

            if (workoutDateStr === todayStr) {
                return { ...workout, weekIndex: parseInt(weekIndex) };
            }
        }
    }

    return null;
}

/**
 * Get upcoming workouts (next N days)
 * @param {number} count - Number of upcoming workouts to return
 * @returns {Array} Array of upcoming workouts
 */
function getUpcomingWorkouts(count = 5) {
    if (!window.state?.generatedWorkouts) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = [];

    // Collect all workouts after today
    for (const weekIndex in window.state.generatedWorkouts) {
        const workouts = window.state.generatedWorkouts[weekIndex];
        if (!workouts) continue;

        for (const workout of workouts) {
            if (!workout.date) continue;
            const workoutDate = new Date(workout.date);
            workoutDate.setHours(0, 0, 0, 0);

            // Only future workouts (not including today)
            if (workoutDate > today) {
                upcoming.push({ ...workout, weekIndex: parseInt(weekIndex) });
            }
        }
    }

    // Sort by date and take first N
    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
    return upcoming.slice(0, count);
}

/**
 * Get this week's workouts for pills display
 * @returns {Array} Array of 7 days with workout info (Mon-Sun)
 */
function getThisWeekWorkouts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find Monday of current week
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const weekDays = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        // Find workout for this date
        let workout = null;
        if (window.state?.generatedWorkouts) {
            for (const weekIndex in window.state.generatedWorkouts) {
                const workouts = window.state.generatedWorkouts[weekIndex];
                if (!workouts) continue;

                workout = workouts.find(w => {
                    if (!w.date) return false;
                    return new Date(w.date).toISOString().split('T')[0] === dateStr;
                });
                if (workout) break;
            }
        }

        const isToday = date.getTime() === today.getTime();
        const isPast = date < today;

        weekDays.push({
            dayName: dayNames[i],
            date: date,
            dateStr: dateStr,
            isToday: isToday,
            isPast: isPast,
            workout: workout
        });
    }

    return weekDays;
}

/**
 * Format relative date label
 * @param {Date} date - Date to format
 * @returns {string} Relative label
 */
function formatRelativeDate(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 6) return targetDate.toLocaleDateString('en-US', { weekday: 'long' });

    return targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Get workout display config
 * @param {string} type - Workout type
 * @returns {Object} Display config
 */
function getWorkoutDisplay(type) {
    return WORKOUT_DISPLAY[type] || WORKOUT_DISPLAY['default'];
}

/**
 * Render the Today Hero Card
 * @returns {string} HTML string
 */
function renderTodayCard() {
    const workout = getTodaysWorkout();
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    if (!workout) {
        // Check if there are upcoming workouts
        const upcoming = getUpcomingWorkouts(1);
        const nextWorkout = upcoming.length > 0 ? upcoming[0] : null;

        if (nextWorkout) {
            // Show "Next Workout" instead of "No Workout Scheduled"
            const nextDisplay = getWorkoutDisplay(nextWorkout.type);
            const nextDate = new Date(nextWorkout.date);
            const relativeLabel = formatRelativeDate(nextDate);

            // Format distance and duration
            let nextDistanceStr = nextWorkout.totalDistance ? `${(nextWorkout.totalDistance / 1000).toFixed(1)} km` : '';
            let nextDurationStr = nextWorkout.totalDuration ? `${Math.round(nextWorkout.totalDuration / 60)} min` : '';
            const nextStats = [nextDistanceStr, nextDurationStr].filter(Boolean).join(' · ');

            return `
                <div class="mobile-today-card" data-color="slate">
                    <div class="today-header">
                        <span class="today-label">📅 TODAY</span>
                        <span class="today-date">${dateStr}</span>
                    </div>
                    <div class="today-content">
                        <div class="today-icon">🛌</div>
                        <div class="today-title">Rest Day</div>
                        <div class="today-subtitle">No workout scheduled for today</div>
                    </div>
                </div>
                <div class="mobile-today-card" data-color="${nextDisplay.color}" style="margin-top: 12px;">
                    <div class="today-header">
                        <span class="today-label">⏭️ NEXT WORKOUT</span>
                        <span class="today-date">${relativeLabel}</span>
                    </div>
                    <div class="today-content">
                        <div class="today-icon">${nextDisplay.icon}</div>
                        <div class="today-title">${nextWorkout.title || nextDisplay.label}</div>
                        ${nextStats ? `<div class="today-stats">${nextStats}</div>` : ''}
                    </div>
                    <div class="today-actions">
                        <button class="today-btn today-btn-secondary" onclick="showWorkoutDetails('${nextWorkout.date}')">
                            <i class="fa-solid fa-info-circle"></i> Details
                        </button>
                    </div>
                </div>
            `;
        }

        // No workouts at all - show empty state with setup button
        return `
            <div class="mobile-today-card mobile-today-empty">
                <div class="today-header">
                    <span class="today-label">📅 TODAY</span>
                    <span class="today-date">${dateStr}</span>
                </div>
                <div class="today-content">
                    <div class="today-icon">📋</div>
                    <div class="today-title">No Workouts Yet</div>
                    <div class="today-subtitle">Generate a plan to see your workouts</div>
                </div>
                <div class="today-actions">
                    <button class="today-btn today-btn-primary" onclick="switchTab('settings')">
                        <i class="fa-solid fa-gear"></i> Open Settings
                    </button>
                </div>
            </div>
        `;
    }

    const display = getWorkoutDisplay(workout.type);
    const isRest = workout.type === 'Rest' || workout.type === 'rest';

    // Format duration
    let durationStr = '';
    if (workout.totalDuration) {
        const mins = Math.round(workout.totalDuration / 60);
        durationStr = `${mins} min`;
    }

    // Format distance
    let distanceStr = '';
    if (workout.totalDistance && workout.totalDistance > 0) {
        const km = (workout.totalDistance / 1000).toFixed(1);
        distanceStr = `${km} km`;
    }

    // Build stats line
    const stats = [distanceStr, durationStr].filter(Boolean).join(' · ');

    if (isRest) {
        return `
            <div class="mobile-today-card mobile-today-rest" data-color="${display.color}">
                <div class="today-header">
                    <span class="today-label">📅 TODAY</span>
                    <span class="today-date">${dateStr}</span>
                </div>
                <div class="today-content">
                    <div class="today-icon">${display.icon}</div>
                    <div class="today-title">${display.label}</div>
                    <div class="today-subtitle">Recovery is training. Trust the process.</div>
                </div>
                <div class="today-stats-bar">
                    <span>💪 Active Days: ${getWeekActiveCount()}</span>
                    <span>📊 Week: ${getWeekVolumeStr()}</span>
                </div>
            </div>
        `;
    }

    return `
        <div class="mobile-today-card" data-color="${display.color}">
            <div class="today-header">
                <span class="today-label">📅 TODAY</span>
                <span class="today-date">${dateStr}</span>
            </div>
            <div class="today-content">
                <div class="today-icon">${display.icon}</div>
                <div class="today-title">${workout.title || display.label}</div>
                ${stats ? `<div class="today-stats">${stats}</div>` : ''}
                ${workout.description ? `<div class="today-description">${truncateText(workout.description, 80)}</div>` : ''}
            </div>
            <div class="today-actions">
                <button class="today-btn today-btn-primary" onclick="openWorkoutInIntervals('${workout.date}')">
                    <i class="fa-solid fa-play"></i> Start
                </button>
                <button class="today-btn today-btn-secondary" onclick="showWorkoutDetails('${workout.date}')">
                    <i class="fa-solid fa-info-circle"></i> Details
                </button>
            </div>
        </div>
    `;
}

/**
 * Render week pills bar
 * @returns {string} HTML string
 */
function renderWeekPills() {
    const weekDays = getThisWeekWorkouts();

    let pillsHtml = weekDays.map(day => {
        const display = day.workout ? getWorkoutDisplay(day.workout.type) : WORKOUT_DISPLAY['default'];
        const classes = [
            'week-pill',
            day.isToday ? 'week-pill-today' : '',
            day.isPast ? 'week-pill-past' : '',
            day.workout ? `week-pill-${display.color}` : 'week-pill-empty'
        ].filter(Boolean).join(' ');

        const shortLabel = day.workout
            ? (day.workout.totalDistance ? `${Math.round(day.workout.totalDistance / 1000)}k` : '')
            : '';

        return `
            <div class="${classes}" onclick="showDayDetail('${day.dateStr}')" data-date="${day.dateStr}">
                <div class="pill-day">${day.dayName}</div>
                <div class="pill-icon">${day.workout ? display.pillIcon : '—'}</div>
                ${shortLabel ? `<div class="pill-label">${shortLabel}</div>` : ''}
            </div>
        `;
    }).join('');

    return `
        <div class="week-pills-container">
            <div class="week-pills-header">THIS WEEK</div>
            <div class="week-pills-scroll">
                ${pillsHtml}
            </div>
        </div>
    `;
}

/**
 * Render upcoming workouts list
 * @returns {string} HTML string
 */
function renderUpcomingList() {
    const upcoming = getUpcomingWorkouts(4);

    if (upcoming.length === 0) {
        return `
            <div class="upcoming-container">
                <div class="upcoming-header">UPCOMING</div>
                <div class="upcoming-empty">No upcoming workouts scheduled</div>
            </div>
        `;
    }

    const itemsHtml = upcoming.map(workout => {
        const display = getWorkoutDisplay(workout.type);
        const date = new Date(workout.date);
        const relativeDate = formatRelativeDate(date);

        // Format duration
        let durationStr = '';
        if (workout.totalDuration) {
            const mins = Math.round(workout.totalDuration / 60);
            durationStr = `${mins}min`;
        }

        // Format distance
        let distanceStr = '';
        if (workout.totalDistance && workout.totalDistance > 0) {
            const km = (workout.totalDistance / 1000).toFixed(1);
            distanceStr = `${km}km`;
        }

        const stats = [distanceStr, durationStr].filter(Boolean).join(' · ');

        return `
            <div class="upcoming-item" data-color="${display.color}" onclick="showWorkoutDetails('${workout.date}')">
                <div class="upcoming-icon">${display.icon}</div>
                <div class="upcoming-content">
                    <div class="upcoming-date">${relativeDate}</div>
                    <div class="upcoming-title">${workout.title || display.label}</div>
                    ${stats ? `<div class="upcoming-stats">${stats}</div>` : ''}
                </div>
                <div class="upcoming-arrow">
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="upcoming-container">
            <div class="upcoming-header">UPCOMING</div>
            <div class="upcoming-list">
                ${itemsHtml}
            </div>
        </div>
    `;
}

/**
 * Render complete mobile today view
 */
function renderMobileTodayView() {
    const container = document.getElementById('mobileTodayView');
    if (!container) return;

    container.innerHTML = `
        ${renderTodayCard()}
        ${renderWeekPills()}
        ${renderUpcomingList()}
    `;
}

// Helper functions
function getWeekActiveCount() {
    const weekDays = getThisWeekWorkouts();
    return weekDays.filter(d => d.isPast && d.workout && d.workout.type !== 'Rest').length;
}

function getWeekVolumeStr() {
    const weekDays = getThisWeekWorkouts();
    let totalKm = 0;
    weekDays.forEach(d => {
        if (d.workout && d.workout.totalDistance) {
            totalKm += d.workout.totalDistance / 1000;
        }
    });
    return `${totalKm.toFixed(0)}km`;
}

function truncateText(text, maxLen) {
    if (!text) return '';
    // Take first line only for mobile
    const firstLine = text.split('\n')[0];
    if (firstLine.length <= maxLen) return firstLine;
    return firstLine.substring(0, maxLen - 3) + '...';
}

function openWorkoutInIntervals(dateStr) {
    // Open Intervals.icu calendar for this date
    const athleteId = window.state?.athleteId;
    if (athleteId) {
        const date = new Date(dateStr);
        const formattedDate = date.toISOString().split('T')[0];
        window.open(`https://intervals.icu/athlete/${athleteId}/calendar?date=${formattedDate}`, '_blank');
    } else {
        showToast('Connect to Intervals.icu first');
    }
}

function showWorkoutDetails(dateStr) {
    // Find workout and show modal
    const workout = findWorkoutByDate(dateStr);
    if (workout) {
        showWorkoutModal(workout);
    }
}

function findWorkoutByDate(dateStr) {
    if (!window.state?.generatedWorkouts) return null;
    const targetDate = new Date(dateStr).toISOString().split('T')[0];

    for (const weekIndex in window.state.generatedWorkouts) {
        const workouts = window.state.generatedWorkouts[weekIndex];
        if (!workouts) continue;

        const found = workouts.find(w => {
            if (!w.date) return false;
            return new Date(w.date).toISOString().split('T')[0] === targetDate;
        });
        if (found) return found;
    }
    return null;
}

function showDayDetail(dateStr) {
    showWorkoutDetails(dateStr);
}

function showWorkoutModal(workout) {
    const display = getWorkoutDisplay(workout.type);
    const duration = workout.totalDuration ? `${Math.round(workout.totalDuration / 60)} min` : '';
    const distance = workout.totalDistance ? `${(workout.totalDistance / 1000).toFixed(1)} km` : '';

    const modalHtml = `
        <div class="workout-modal-overlay" onclick="closeWorkoutModal()">
            <div class="workout-modal" onclick="event.stopPropagation()">
                <div class="workout-modal-header" data-color="${display.color}">
                    <span class="workout-modal-icon">${display.icon}</span>
                    <span class="workout-modal-title">${workout.title || display.label}</span>
                    <button class="workout-modal-close" onclick="closeWorkoutModal()">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
                <div class="workout-modal-body">
                    <div class="workout-modal-stats">
                        ${distance ? `<div class="stat"><i class="fa-solid fa-route"></i> ${distance}</div>` : ''}
                        ${duration ? `<div class="stat"><i class="fa-solid fa-clock"></i> ${duration}</div>` : ''}
                    </div>
                    ${workout.description ? `
                        <div class="workout-modal-description">
                            <div class="desc-label">Workout Details</div>
                            <pre class="desc-content">${workout.description}</pre>
                        </div>
                    ` : ''}
                </div>
                <div class="workout-modal-actions">
                    <button class="modal-btn modal-btn-primary" onclick="openWorkoutInIntervals('${workout.date}')">
                        <i class="fa-solid fa-external-link"></i> Open in Intervals.icu
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add modal to body
    const modalContainer = document.createElement('div');
    modalContainer.id = 'workoutModalContainer';
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
}

function closeWorkoutModal() {
    const container = document.getElementById('workoutModalContainer');
    if (container) container.remove();
}

// Expose to window
window.renderMobileTodayView = renderMobileTodayView;
window.getTodaysWorkout = getTodaysWorkout;
window.getUpcomingWorkouts = getUpcomingWorkouts;
window.getThisWeekWorkouts = getThisWeekWorkouts;
window.openWorkoutInIntervals = openWorkoutInIntervals;
window.showWorkoutDetails = showWorkoutDetails;
window.showDayDetail = showDayDetail;
window.closeWorkoutModal = closeWorkoutModal;

console.log('[MobileToday] Mobile today view loaded');
