/**
 * Base Sport Adapter
 * Defines the interface that all sports must implement.
 */
class SportAdapter {
    constructor(name, id) {
        this.name = name;
        this.id = id;
    }

    /**
     * Returns the HTML ID for the configuration container for this sport.
     * @returns {string}
     */
    getConfigContainerId() {
        throw new Error("Method 'getConfigContainerId' must be implemented.");
    }

    /**
     * Returns the default plan start date input ID.
     * @returns {string}
     */
    getPlanStartDateInputId() {
        throw new Error("Method 'getPlanStartDateInputId' must be implemented.");
    }

    /**
     * Generates a training plan based on the provided inputs.
     * @param {Object} inputs - A map of input values from the UI.
     * @param {Object} globalSettings - Global settings like race date, athlete history, etc.
     * @returns {Array} The generated plan (array of weeks).
     */
    generatePlan(inputs, globalSettings) {
        throw new Error("Method 'generatePlan' must be implemented.");
    }

    /**
     * Returns the metric unit for volume (e.g., "km", "TSS").
     * @returns {string}
     */
    getVolumeUnit() {
        return "km";
    }

    /**
     * Returns the label for the long session (e.g., "Long Run", "Long Ride").
     * @returns {string}
     */
    getLongSessionLabel() {
        return "Long Session";
    }
}

// Ensure Global Access
window.SportAdapter = SportAdapter;

// Expose to window for inheritance in other files
window.SportAdapter = SportAdapter;
