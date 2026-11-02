(request, tierSupplement) => {

    const exports = {
        list: [],
        byId: {},
        byName: {}
    };

    async function initialise() {
        const monsters = await request.listMonsters();
        const known = new Set(monsters.map(monster => monster.id));
        for (const extra of tierSupplement.monsters) {
            if (!known.has(extra.id)) {
                monsters.push(extra);
                known.add(extra.id);
            }
        }
        for (const monster of monsters) {
            exports.list.push(monster);
            exports.byId[monster.id] = monster;
            if (exports.byName[monster.name] === undefined) {
                exports.byName[monster.name] = monster;
            }
        }
        return exports;
    }

    return initialise();

}
