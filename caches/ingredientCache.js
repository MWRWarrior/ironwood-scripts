(request, tierSupplement) => {

    const exports = {
        list: [],
        byAction: {},
        byItem: {}
    };

    async function initialise() {
        const ingredients = await request.listIngredients();
        const known = new Set(ingredients.map(ingredient => ingredient.id));
        for (const extra of tierSupplement.ingredients) {
            if (!known.has(extra.id)) {
                ingredients.push(extra);
                known.add(extra.id);
            }
        }
        for(const ingredient of ingredients) {
            exports.list.push(ingredient);
            if(!exports.byAction[ingredient.action]) {
                exports.byAction[ingredient.action] = [];
            }
            exports.byAction[ingredient.action].push(ingredient);
            if(!exports.byItem[ingredient.item]) {
                exports.byItem[ingredient.item] = [];
            }
            exports.byItem[ingredient.item].push(ingredient);
        }
        return exports;
    }

    return initialise();

}
