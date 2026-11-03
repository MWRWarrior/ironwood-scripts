(Promise, pages, components, request, configuration) => {

    const PAGE_NAME = 'Plugin changelog';
    const loaded = new Promise.Deferred('changelog');

    let changelogs = null;

    const localChangelogs = [{
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
