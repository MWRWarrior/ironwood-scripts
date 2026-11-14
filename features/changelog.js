(Promise, pages, components, request, configuration) => {

    const PAGE_NAME = 'Plugin changelog';
    const loaded = new Promise.Deferred('changelog');

    let changelogs = null;

    const localChangelogs = [{
        id: 1610,
        time: '2026-11-14T18:35:00.000Z',
        title: 'v6.5.7 - Script load',
        entries: [
            'Fixed - Script - The market filter update no longer stops the script from loading'
        ]
    }, {
        id: 1609,
        time: '2026-11-14T16:30:00.000Z',
        title: 'v6.5.6 - Market filters',
        entries: [
            'Added - Market filter - Tier 115 and 130 items are included in the resource filters'
        ]
    }, {
        id: 1608,
        time: '2026-11-11T05:00:00.000Z',
        title: 'v6.5.5 - Market sorting',
        entries: [
            'Fixed - Market - Name search and price sort no longer get overwritten'
        ]
    }, {
        id: 1607,
        time: '2026-11-11T00:00:00.000Z',
        title: 'v6.5.4 - Gathering prices',
        entries: [
            'Fixed - Estimations - Tier 115 and 130 gathering prices autofill'
        ]
    }, {
        id: 1606,
        time: '2026-11-03T02:10:00.000Z',
        title: 'v6.5.3 - Consumed resources',
        entries: [
            'Fixed - Estimations - Tier 115 and 130 actions consume charcoal, compost, arcane powder, metal parts, potion mix, and sigil pieces'
        ]
    }, {
        id: 1605,
        time: '2026-11-03T02:05:00.000Z',
        title: 'v6.5.2 - Item names',
        entries: [
            'Fixed - Items - Tier 115 and 130 outputs keep their own name and image'
        ]
    }, {
        id: 1604,
        time: '2026-11-03T01:55:00.000Z',
        title: 'v6.5.1 - Version warning',
        entries: [
            'Fixed - Version warning - The Pancake update toast no longer appears'
        ]
    }, {
        id: 1603,
        time: '2026-11-03T01:45:00.000Z',
        title: 'v6.5.0 - Tiers 115 and 130',
        entries: [
            'Added - Actions, items, and monsters for level 115 and 130',
            'Fixed - Estimations - Combat experience per hour',
            'Fixed - Estimations - Mastery contracts follow the per-skill toggle',
            'Fixed - Market filter - Order listings by price of the selected resource',
            'Patched - Next tier and goal level continue through 115 and 130',
            'Fixed - Version warning - Only appears when a newer fork release is published'
        ]
    }];

    async function initialise() {
        await pages.register({
            category: 'Skills',
            after: 'Changelog',
            name: PAGE_NAME,
            image: 'https://ironwoodrpg.com/assets/misc/changelog.png',
            render: renderPage
        });
        configuration.registerCheckbox({
            category: 'Pages',
            key: 'changelog-enabled',
            name: 'Changelog',
            default: true,
            handler: handleConfigStateChange
        });
        load();
    }

    function handleConfigStateChange(state, name) {
        if(state) {
            pages.show(PAGE_NAME);
        } else {
            pages.hide(PAGE_NAME);
        }
    }

    async function load() {
        changelogs = localChangelogs.concat(await request.getChangelogs());
        loaded.resolve();
    }

    async function renderPage() {
        await loaded;
        const header = components.search(componentBlueprint, 'header');
        const list = components.search(componentBlueprint, 'list');
        for(const index in changelogs) {
            componentBlueprint.componentId = `changelogComponent_${index}`;
            header.title = changelogs[index].title;
            header.textRight = new Date(changelogs[index].time).toLocaleDateString();
            list.entries = changelogs[index].entries;
            components.addComponent(componentBlueprint);
        }
    }

    const componentBlueprint = {
        componentId: 'changelogComponent',
        dependsOn: 'custom-page',
        parent: '.column0',
        selectedTabIndex: 0,
        tabs: [{
            title: 'tab',
            rows: [{
                id: 'header',
                type: 'header',
                title: '',
                textRight: ''
            },{
                id: 'list',
                type: 'list',
                entries: []
            }]
        }]
    };

    initialise();

}
