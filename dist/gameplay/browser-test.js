import { DrifterRoster, MovementController, InventorySystem, InteractionSystem, HuskSystem, WorldInfoLayer, RunManager, } from './index.js';
import { WorldGenerator } from '../worldgen.js';
import { ID } from '../utils.js';
import { WeatherType } from '../types.js';
function appendLine(text) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    document.body.appendChild(paragraph);
}
function createTestWorld() {
    const generator = new WorldGenerator({ seed: 12345, zoneCount: 4, difficulty: 3, era: 'Early Collapse' });
    const { zones } = generator.generate();
    return zones[0];
}
async function runBrowserSmokeTest() {
    document.body.style.fontFamily = 'system-ui, sans-serif';
    document.body.style.background = '#111';
    document.body.style.color = '#eee';
    document.body.style.margin = '24px';
    appendLine('Starting browser smoke test...');
    const zone = createTestWorld();
    appendLine(`Zone generated: ${zone.name} (${zone.type})`);
    const roster = new DrifterRoster(12345);
    const drifterEntity = roster.drawDrifter('run-001', zone.id, { x: 128, y: 128 });
    const drifter = drifterEntity.drifter;
    appendLine(`Drifter spawned: ${drifter.name} from ${drifter.origin}`);
    const movement = new MovementController({ drifter, zone, building: null });
    movement.setInput({ x: 1, y: 0 });
    movement.update(0.5);
    appendLine(`Drifter moved to (${Math.round(drifter.position.x)}, ${Math.round(drifter.position.y)})`);
    const inventory = new InventorySystem();
    const item = {
        id: ID.create('item'),
        name: 'Test Item',
        description: 'A test artifact.',
        iconIndex: 1,
        isWeapon: false,
        value: 5,
        weight: 1,
        position: { x: drifter.position.x, y: drifter.position.y },
        buildingID: ID.create('building'),
        roomID: null,
    };
    const canCarry = inventory.canAddItem(drifter, item);
    appendLine(`Inventory can carry test item: ${canCarry}`);
    const interaction = new InteractionSystem();
    const entry = interaction.interactWithItem(drifter, item);
    drifterEntity.addLogbookEntry(entry);
    appendLine(`Created logbook entry: ${entry.title}`);
    const huskSystem = new HuskSystem({ seed: 12345, zone, huskCount: 3, weather: WeatherType.OVERCAST });
    const [huskResult] = huskSystem.update(0.2, drifter, {
        drifterNoise: 0.6,
        ambientNoise: 0.4,
        timeOfDay: 14,
        weather: WeatherType.OVERCAST,
        obstacles: [],
    });
    appendLine(`Husk state after update: ${huskResult.husk.state}`);
    const worldInfo = new WorldInfoLayer({ storageKey: 'drifter_browser_test' });
    const deposit = worldInfo.addDeposit({
        zoneType: zone.type,
        region: zone.region,
        position: { x: drifter.position.x, y: drifter.position.y },
        text: 'Safe house beacon found.',
        tags: ['safe', 'zone'],
        originRunID: drifter.runID,
    });
    appendLine(`World info deposit stored: ${deposit.id}`);
    const runManager = new RunManager({ seed: 12345, hqPosition: { x: 256, y: 256 } });
    runManager.startRun(drifter, zone);
    runManager.recordResource(item);
    runManager.recordLogbookEntry(entry);
    runManager.recordDeduction(entry);
    const completed = runManager.completeRun();
    appendLine(`Run completed: ${completed?.status}`);
    appendLine('Smoke test finished successfully.');
}
runBrowserSmokeTest().catch((error) => {
    console.error(error);
    appendLine(`ERROR: ${error?.message ?? error}`);
});
//# sourceMappingURL=browser-test.js.map