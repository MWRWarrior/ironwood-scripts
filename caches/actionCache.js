(request, tierSupplement) => {

    const exports = {
        list: [],
        byId: {},
        byName: {}
    };

    async function initialise() {
        const actions = await request.listActions();
        const known = new Set(actions.map(action => action.id));
        for (const extra of tierSupplement.actions) {
            if (!known.has(extra.id)) {
                actions.push(extra);
                known.add(extra.id);
            }
        }
        for (const action of actions) {
            exports.list.push(action);
            exports.byId[action.id] = action;
            if (exports.byName[action.name] === undefined) {
                exports.byName[action.name] = action;
            }
        }
        return exports;
    }

    return initialise();

}
