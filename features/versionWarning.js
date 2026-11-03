(toast) => {

    const VERSION_URL = 'https://raw.githubusercontent.com/MWRWarrior/ironwood-scripts/tiers-115-130/version.txt';
    const UPDATE_URL = 'https://github.com/MWRWarrior/ironwood-scripts/raw/tiers-115-130/ironwood-rpg.user.js';

    function initialise() {
        setInterval(run, 1000 * 60 * 5);
        run();
    }

    function isNewer(remote, local) {
        const parse = value => String(value).trim().split('.').map(part => parseInt(part, 10) || 0);
        const remoteParts = parse(remote);
        const localParts = parse(local);
        const length = Math.max(remoteParts.length, localParts.length);
        for(let index = 0; index < length; index++) {
            const difference = (remoteParts[index] || 0) - (localParts[index] || 0);
            if(difference !== 0) {
                return difference > 0;
            }
        }
        return false;
    }

    async function run() {
        if(!window.PANCAKE_VERSION) {
            return;
        }
        let remoteVersion;
        try {
            const response = await fetch(VERSION_URL, {cache: 'no-store'});
            if(!response.ok) {
                return;
            }
            remoteVersion = (await response.text()).trim();
        } catch(e) {
            return;
        }
        if(!remoteVersion || !isNewer(remoteVersion, window.PANCAKE_VERSION)) {
            return;
        }
        toast.create({
            text: `<a href='${UPDATE_URL}' target='_blank'>Consider updating Ironwood RPG - MWR Fork to ${remoteVersion}!<br>Click here to install the update</a>`,
            image: 'https://img.icons8.com/?size=48&id=iAqIpjeFjcYz&format=png',
            time: 5000
        });
    }

    initialise();

}
