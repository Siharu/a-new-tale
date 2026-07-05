import { DrifterRoster, MovementController, HuskSystem, InteractionSystem, InventorySystem, WorldInfoLayer, RunManager } from './index.js';
import { WorldGenerator } from '../worldgen.js';
import { ID } from '../utils.js';
import { WeatherType } from '../types.js';
function createTestWorld() {
    const generator = new WorldGenerator({ seed: 12345, zoneCount: 4, difficulty: 3, era: 'Early Collapse' });
    const { zones } = generator.generate();
    return zones[0];
}
function createTestDrifter(zone) {
    const roster = new DrifterRoster(12345);
    const drifterEntity = roster.drawDrifter('test-run', zone.id, { x: 128, y: 128 });
    return { roster, drifterEntity };
}
function runGameplaySmokeTest() {
    const zone = createTestWorld();
    const { drifterEntity } = createTestDrifter(zone);
    const drifter = drifterEntity.drifter;
    const movement = new MovementController({ drifter, zone, building: null });
    movement.setInput({ x: 1, y: 0 });
    movement.update(0.5);
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
    const added = inventory.addItem(drifter, item);
    const interaction = new InteractionSystem();
    const entry = interaction.interactWithItem(drifter, item);
    drifterEntity.addLogbookEntry(entry);
    const huskSystem = new HuskSystem({ seed: 12345, zone, huskCount: 3, weather: WeatherType.OVERCAST });
    const [huskResult] = huskSystem.update(0.2, drifter, {
        drifterNoise: 0.6,
        ambientNoise: 0.4,
        timeOfDay: 14,
        weather: WeatherType.OVERCAST,
        obstacles: [],
    });
    const worldInfo = new WorldInfoLayer({ storageKey: 'drifter_test' });
    const deposit = worldInfo.addDeposit({
        zoneType: zone.type,
        region: zone.region,
        position: { x: drifter.position.x, y: drifter.position.y },
        text: 'Safe house beacon found.',
        tags: ['safe', 'zone'],
        originRunID: drifter.runID,
    });
    const runManager = new RunManager({ seed: 12345, hqPosition: { x: 256, y: 256 } });
    runManager.startRun(drifter, zone);
    runManager.recordResource(item);
    runManager.recordLogbookEntry(entry);
    runManager.recordDeduction(entry);
    const completed = runManager.completeRun();
    console.log('movement:', drifter.position, 'added:', added, 'huskState:', huskResult.husk.state, 'depositID:', deposit.id, 'runStatus:', completed?.status);
}
runGameplaySmokeTest();
//# sourceMappingURL=gameplay-test.js.map