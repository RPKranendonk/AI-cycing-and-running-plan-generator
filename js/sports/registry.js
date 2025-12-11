class SportRegistry {
    constructor() {
        this.adapters = new Map();
        // We can't register here immediately if the classes aren't defined yet.
        // But if we load scripts in order, it should be fine.
        // Or we register explicitly in main.js
        // Let's try to register if they exist.
        if (typeof RunningAdapter !== 'undefined') this.register(new RunningAdapter());
        if (typeof CyclingAdapter !== 'undefined') this.register(new CyclingAdapter());
    }

    register(adapter) {
        this.adapters.set(adapter.name, adapter);
    }

    getAdapter(name) {
        return this.adapters.get(name);
    }

    getAllAdapters() {
        return Array.from(this.adapters.values());
    }

    getSports() {
        return Array.from(this.adapters.keys());
    }
}

window.sportRegistry = new SportRegistry();
