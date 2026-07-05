import type { ZoneType } from '../types.js';
export interface WorldInfoDeposit {
    id: string;
    zoneType: ZoneType;
    region: string;
    position: {
        x: number;
        y: number;
    };
    text: string;
    tags: string[];
    createdAt: number;
    originRunID: string;
}
export interface WorldInfoLayerOptions {
    storageKey?: string;
    initialDeposits?: WorldInfoDeposit[];
}
export declare class WorldInfoLayer {
    private storageKey;
    private deposits;
    constructor(options?: WorldInfoLayerOptions);
    addDeposit(deposit: Omit<WorldInfoDeposit, 'id' | 'createdAt'>): WorldInfoDeposit;
    getDepositsForZone(zoneType: ZoneType, region?: string): WorldInfoDeposit[];
    listAllDeposits(): WorldInfoDeposit[];
    clearDeposits(): void;
    importDeposits(deposits: WorldInfoDeposit[]): void;
    private load;
    private save;
}
//# sourceMappingURL=WorldInfoLayer.d.ts.map