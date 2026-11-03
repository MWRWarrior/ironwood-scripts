import { promises as fs } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = process.argv[2] || path.join(process.env.TEMP || '/tmp', 'iw_main.js');
const OUT = path.resolve(__dirname, '../caches/tierSupplement.js');

const SKILL_BY_EQUIPMENT = {
    Hatchet: 'Woodcutting',
    Pickaxe: 'Mining',
    Spade: 'Farming',
    Rod: 'Fishing',
    Lantern: 'Delving',
    Compass: 'Exploring'
};

function sliceEnum(source, anchor) {
    const at = source.indexOf(anchor);
    if (at < 0) {
        throw new Error(`Missing anchor ${anchor}`);
    }
    const start = source.lastIndexOf('={}', at);
    const end = source.indexOf('})()', at);
    return source.slice(start, end);
}

function parseStringEnum(chunk) {
    const map = {};
    for (const match of chunk.matchAll(/\.([A-Za-z0-9_]+)="([^"]*)"/g)) {
        map[match[1]] = /^-?\d+$/.test(match[2]) ? Number(match[2]) : match[2];
    }
    return map;
}

function parseSpeedEnum(source) {
    const at = source.indexOf('c.Fast=2');
    const chunk = source.slice(at - 80, at + 80);
    const map = {};
    for (const match of chunk.matchAll(/\.([A-Za-z]+)=([0-9.]+)/g)) {
        map[match[1]] = Number(match[2]);
    }
    return map;
}

function replaceRefs(text, maps) {
    return text.replace(/n\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/g, (full, prefix, name) => {
        const map = maps[prefix];
        if (!map || map[name] === undefined) {
            return 'null';
        }
        return JSON.stringify(map[name]);
    });
}

function collectKeyedObjects(source, prefix) {
    const needle = `[n.${prefix}.`;
    const objects = [];
    let cursor = 0;
    while ((cursor = source.indexOf(needle, cursor)) !== -1) {
        const keyStart = cursor + needle.length;
        const keyEnd = source.indexOf(']', keyStart);
        if (source.slice(keyEnd, keyEnd + 3) !== ']:{') {
            cursor = keyEnd + 1;
            continue;
        }
        const key = source.slice(keyStart, keyEnd);
        const brace = keyEnd + 2;
        let depth = 0;
        let end = brace;
        for (let i = brace; i < source.length; i++) {
            const ch = source[i];
            if (ch === '"' || ch === "'") {
                const quote = ch;
                i++;
                while (i < source.length && source[i] !== quote) {
                    if (source[i] === '\\') i++;
                    i++;
                }
                continue;
            }
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }
        objects.push({ key, text: source.slice(brace, end + 1) });
        cursor = end + 1;
    }
    return objects;
}

function splitObjects(body) {
    const objects = [];
    let depth = 0;
    let start = -1;
    let key = null;
    for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (ch === '"' || ch === "'") {
            const quote = ch;
            i++;
            while (i < body.length && body[i] !== quote) {
                if (body[i] === '\\') i++;
                i++;
            }
            continue;
        }
        if (ch === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0 && start >= 0) {
                objects.push({ key, text: body.slice(start, i + 1) });
                start = -1;
                key = null;
            }
        } else if (depth === 0 && ch === '[') {
            const close = body.indexOf(']', i);
            key = body.slice(i + 1, close);
            i = close;
        }
    }
    return objects;
}

function evalObject(text) {
    return Function(`"use strict"; return (${text});`)();
}

function prepare(text, maps, monstersById, itemsById) {
    let result = replaceRefs(text, maps);
    result = result.replace(/M\[[^\]]+\]/g, '0');
    if (itemsById) {
        result = result.replace(/T\[(\d+)\]\.name/g, (_, id) => JSON.stringify(itemsById[id]?.name || ''));
        result = result.replace(/T\[(\d+)\]\.image/g, (_, id) => JSON.stringify(itemsById[id]?.image || ''));
    } else {
        result = result.replace(/T\[\d+\]\.image/g, '""');
        result = result.replace(/T\[\d+\]\.name/g, '""');
    }
    if (monstersById) {
        result = result.replace(/en\[(\d+)\]\.name/g, (_, id) => JSON.stringify(monstersById[id]?.name || ''));
        result = result.replace(/en\[(\d+)\]\.image/g, (_, id) => JSON.stringify(monstersById[id]?.image || ''));
        result = result.replace(/en\[(\d+)\]\.level/g, (_, id) => String(monstersById[id]?.level || 0));
    }
    result = result.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (full, name) => {
        if (name === 'true' || name === 'false' || name === 'null') {
            return full;
        }
        return ':null';
    });
    return result;
}

function flattenDrops(action) {
    const drops = [];
    const readTable = (list, scale = 1) => {
        if (!Array.isArray(list)) return;
        let previous = 0;
        for (const entry of list) {
            const ceiling = entry.chance == null ? previous : entry.chance;
            const width = Math.max(0, (ceiling - previous) / 1000) * scale;
            if (entry.chance != null) {
                previous = entry.chance;
            }
            if (entry.drops) {
                readTable(entry.drops, width);
            } else if (entry.id != null && width > 0) {
                drops.push({
                    item: entry.id,
                    chance: width,
                    amount: entry.amount || 1,
                    type: width >= 0.999 ? 'GUARANTEED' : 'REGULAR'
                });
            }
        }
    };
    if (action.drop?.id) {
        drops.push({
            item: action.drop.id,
            chance: 1,
            amount: action.drop.amount || 1,
            type: 'GUARANTEED'
        });
    }
    readTable(action.drops || []);
    return drops;
}

function inferSkill(action, equipmentNames) {
    if (action.monsterId && !action.equipment) {
        return 'Combat';
    }
    const equipment = equipmentNames[action.equipment];
    if (equipment && SKILL_BY_EQUIPMENT[equipment]) {
        return SKILL_BY_EQUIPMENT[equipment];
    }
    const name = action.name || '';
    if (/Bar$/.test(name)) return 'Smelting';
    if (/Potion|Catalyst|Mix/.test(name)) return 'Alchemy';
    if (/Sigil/.test(name)) return 'Imbuing';
    if (/Key|Essence|Enchant/.test(name)) return 'Enchanting';
    if (/Bar|Helmet|Sword|Hammer|Body|Shield|Hatchet|Pickaxe|Rod|Spade|Bow|Boomerang|Spear|Scythe|Lantern|Compass|Gloves|Boots/.test(name)) return 'Smithing';
    if (/Cooked|Pie/.test(name)) return 'Cooking';
        if (/^Raw |Marlin|Dragonfish|Fish/.test(name)) return 'Fishing';
    if (/Tree|Logbook|Log/.test(name)) return /Logbook/.test(name) ? 'Exploring' : 'Woodcutting';
    if (/Rock|Ore/.test(name)) return 'Mining';
    if (/Crystal/.test(name)) return 'Delving';
    if (/Flower|Seed|Herb|Verbena|Parsnip/.test(name)) return 'Farming';
    return null;
}

function inferType(action) {
    if (action.isOutskirts) return 'OUTSKIRTS';
    if (action.isElite) return 'ELITE';
    if (action.monsterId && !action.equipment) return 'MONSTER';
    return 'ACTIVITY';
}

function displayName(action, type) {
    if (type === 'OUTSKIRTS') return `Outskirts ${action.name}`;
    if (type === 'ELITE' && !String(action.name).startsWith('Elite ')) return `Elite ${action.name}`;
    return action.name;
}

function toItemRecord(id, item) {
    return {
        item: {
            id,
            name: item.name,
            image: item.image || '',
            skill: null,
            tier: item.tier ?? null,
            attributes: {
                BUY_PRICE: 0,
                SELL_PRICE: 0,
                MIN_MARKET_PRICE: 0,
                UNTRADEABLE: !!item.untradeable
            }
        },
        charcoal: item.charcoal || 0,
        compost: item.compost || 0,
        arcanePowder: item.arcanePowder || 0,
        petSnacks: item.petSnacks || 0,
        metalParts: item.metalParts || 0,
        sigilPieces: item.sigilPieces || 0,
        researchPoints: item.researchPoints || 0,
        stats: { global: {}, bySkill: {} }
    };
}

async function main() {
    const source = await fs.readFile(BUNDLE, 'utf8');
    const actionIds = parseStringEnum(sliceEnum(source, 'ShadowbarkTree="2000"'));
    const itemIds = parseStringEnum(sliceEnum(source, 'SylvanBar="1603"'));
    const monsterIds = parseStringEnum(sliceEnum(source, 'OutskirtsGolem="206"'));
    const equipment = parseStringEnum(sliceEnum(source, '.Hatchet="101"'));
    const speeds = parseSpeedEnum(source);
    const styles = { OneHanded: 'OneHanded', TwoHanded: 'TwoHanded', Ranged: 'Ranged' };
    const maps = { Xv: actionIds, AM: itemIds, Aw: monsterIds, nr: equipment, Hs: speeds, Mz: styles };
    const equipmentNames = Object.fromEntries(Object.entries(equipment).map(([name, id]) => [id, name]));
    if (actionIds.ShadowbarkTree !== 2000 || itemIds.SylvanBar !== 1603 || itemIds.GlacialBar !== 1803 || monsterIds.OutskirtsGolem !== 206) {
        throw new Error(`Id enum mismatch actions=${actionIds.ShadowbarkTree} sylvanBar=${itemIds.SylvanBar} glacialBar=${itemIds.GlacialBar} golem=${monsterIds.OutskirtsGolem}`);
    }

    const itemsById = {};
    for (const piece of collectKeyedObjects(source, 'AM')) {
        const text = prepare(piece.text, maps);
        let item;
        try {
            item = evalObject(text);
        } catch {
            continue;
        }
        const id = itemIds[piece.key] || Number(item?.id);
        if (!id || !item?.name || itemsById[id]) continue;
        itemsById[id] = item;
    }

    const monstersById = {};
    for (const piece of collectKeyedObjects(source, 'Aw')) {
        const text = prepare(piece.text, maps);
        let monster;
        try {
            monster = evalObject(text);
        } catch {
            continue;
        }
        const id = monsterIds[piece.key] || Number(monster?.id);
        if (!id || !monster?.name || (monster.level || 0) < 115) continue;
        monstersById[id] = monster;
    }

    const parsedActions = [];
    let evalFailures = 0;
    for (const piece of collectKeyedObjects(source, 'Xv')) {
        const text = prepare(piece.text, maps, monstersById, itemsById);
        let action;
        try {
            action = evalObject(text);
        } catch {
            evalFailures++;
            continue;
        }
        const id = actionIds[piece.key] || Number(action?.id);
        if (!id || !action?.name || (action.level || 0) < 115) continue;
        parsedActions.push({ ...action, id, _key: piece.key });
    }

    const actions = [];
    const referencedItems = new Set();
    const referencedMonsters = new Set();
    const skipped = [];
    for (const action of parsedActions) {
        const skill = inferSkill(action, equipmentNames);
        if (!skill) {
            skipped.push(action.name);
            continue;
        }
        let type = inferType(action);
        if (type === 'MONSTER' && String(action._key || '').startsWith('Elite')) {
            type = 'ELITE';
        }
        const item = action.drop?.id || (action.drops || []).find(drop => drop.id)?.id || null;
        actions.push({
            id: action.id,
            skill,
            type,
            structure: null,
            monster: action.monsterId || null,
            item,
            name: displayName(action, type),
            image: action.image || '',
            level: action.level,
            exp: action.exp,
            speed: action.speed,
            tier: action.tier,
            monsterGroup: null,
            outskirtsMonsterChance: 1000,
            _raw: action
        });
        if (item) referencedItems.add(item);
        if (action.monsterId) referencedMonsters.add(action.monsterId);
        for (const drop of flattenDrops(action)) referencedItems.add(drop.item);
        for (const material of action.materials || []) referencedItems.add(material.id);
    }
    for (const level of [115, 130]) {
        if (itemIds[`EliteKey${level}`]) referencedItems.add(itemIds[`EliteKey${level}`]);
    }

    const items = [];
    const seenItems = new Set();
    for (const [id, item] of Object.entries(itemsById)) {
        const numericId = Number(id);
        if (!referencedItems.has(numericId)) continue;
        seenItems.add(numericId);
        items.push(toItemRecord(numericId, item));
    }

    const monsters = [];
    for (const id of referencedMonsters) {
        const monster = monstersById[id];
        if (!monster) continue;
        monsters.push({
            id: Number(id),
            name: monster.name,
            image: monster.image,
            attackStyle: monster.attackStyle || 'OneHanded',
            level: monster.level,
            health: monster.health,
            attack: monster.damage,
            armour: monster.armour || 0,
            speed: monster.speed || 2
        });
    }

    const drops = [];
    const ingredients = [];
    let dropId = -900000;
    let ingredientId = -910000;
    for (const action of actions) {
        for (const drop of flattenDrops(action._raw)) {
            drops.push({
                id: dropId--,
                action: action.id,
                item: drop.item,
                type: drop.type,
                chance: Math.round(drop.chance * 10000) / 10000,
                amount: drop.amount
            });
        }
        for (const material of action._raw.materials || []) {
            ingredients.push({
                id: ingredientId--,
                action: action.id,
                item: material.id,
                amount: material.amount || 1
            });
        }
        delete action._raw;
        delete action._key;
    }

    const payload = { actions, items, monsters, drops, ingredients };
    await fs.writeFile(OUT, `() => (${JSON.stringify(payload)})\n`);
    const bySkill = actions.reduce((counts, action) => (counts[action.skill] = (counts[action.skill] || 0) + 1, counts), {});
    console.log(JSON.stringify({
        actions: actions.length,
        items: items.length,
        monsters: monsters.length,
        drops: drops.length,
        ingredients: ingredients.length,
        evalFailures,
        skipped,
        bySkill
    }, null, 2));
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
