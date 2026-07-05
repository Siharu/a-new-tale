/**
 * DRIFTER ENGINE TYPE DEFINITIONS
 * No implementation — pure schema/contracts
 */
// ─── ENUMS ───
export var ZoneType;
(function (ZoneType) {
    ZoneType["RESIDENTIAL_DISTRICT"] = "RESIDENTIAL_DISTRICT";
    ZoneType["INDUSTRIAL_COMPLEX"] = "INDUSTRIAL_COMPLEX";
    ZoneType["RURAL_RELAY"] = "RURAL_RELAY";
    ZoneType["SIGNAL_HUB"] = "SIGNAL_HUB";
    ZoneType["ARCHIVE"] = "ARCHIVE";
    ZoneType["RUINS"] = "RUINS";
})(ZoneType || (ZoneType = {}));
export var BuildingType;
(function (BuildingType) {
    BuildingType["RESIDENTIAL"] = "RESIDENTIAL";
    BuildingType["INDUSTRIAL"] = "INDUSTRIAL";
    BuildingType["SIGNAL_TOWER"] = "SIGNAL_TOWER";
    BuildingType["ARCHIVE"] = "ARCHIVE";
    BuildingType["MAINTENANCE"] = "MAINTENANCE";
    BuildingType["RADIO_STATION"] = "RADIO_STATION";
    BuildingType["POWER_PLANT"] = "POWER_PLANT";
    BuildingType["WAREHOUSE"] = "WAREHOUSE";
})(BuildingType || (BuildingType = {}));
export var RoomType;
(function (RoomType) {
    RoomType["OFFICE"] = "OFFICE";
    RoomType["STORAGE"] = "STORAGE";
    RoomType["RADIO_STATION"] = "RADIO_STATION";
    RoomType["SERVER_ROOM"] = "SERVER_ROOM";
    RoomType["ARCHIVE"] = "ARCHIVE";
    RoomType["HALLWAY"] = "HALLWAY";
    RoomType["BASEMENT"] = "BASEMENT";
    RoomType["ROOFTOP"] = "ROOFTOP";
    RoomType["LIVING_QUARTERS"] = "LIVING_QUARTERS";
    RoomType["LABORATORY"] = "LABORATORY";
})(RoomType || (RoomType = {}));
export var WeatherType;
(function (WeatherType) {
    WeatherType["CLEAR"] = "CLEAR";
    WeatherType["OVERCAST"] = "OVERCAST";
    WeatherType["FOG_HEAVY"] = "FOG_HEAVY";
    WeatherType["ACID_RAIN"] = "ACID_RAIN";
    WeatherType["DEAD_CALM"] = "DEAD_CALM";
    WeatherType["STATIC_STORM"] = "STATIC_STORM";
    WeatherType["DUST_EVENT"] = "DUST_EVENT";
})(WeatherType || (WeatherType = {}));
export var WrongnessState;
(function (WrongnessState) {
    WrongnessState["SUNNY"] = "SUNNY";
    WrongnessState["BLUE"] = "BLUE";
    WrongnessState["GREY"] = "GREY";
    WrongnessState["RAINY"] = "RAINY";
    WrongnessState["STATIC"] = "STATIC";
    WrongnessState["UNKNOWN"] = "UNKNOWN";
    WrongnessState["STORMY"] = "STORMY";
    WrongnessState["DIFFERENT"] = "DIFFERENT";
    WrongnessState["ANOTHER_SKY"] = "ANOTHER_SKY";
})(WrongnessState || (WrongnessState = {}));
export var HazardType;
(function (HazardType) {
    HazardType["HUSK_NEST"] = "HUSK_NEST";
    HazardType["FOG_POCKET"] = "FOG_POCKET";
    HazardType["SIGNAL_DEAD_ZONE"] = "SIGNAL_DEAD_ZONE";
    HazardType["STRUCTURAL_DECAY"] = "STRUCTURAL_DECAY";
    HazardType["ACID_RAIN_ZONE"] = "ACID_RAIN_ZONE";
    HazardType["ANOMALY"] = "ANOMALY";
})(HazardType || (HazardType = {}));
export var InteractableType;
(function (InteractableType) {
    InteractableType["ITEM"] = "ITEM";
    InteractableType["DOOR"] = "DOOR";
    InteractableType["ANOMALY"] = "ANOMALY";
    InteractableType["HQ_ENTRANCE"] = "HQ_ENTRANCE";
    InteractableType["INVESTIGATION_POINT"] = "INVESTIGATION_POINT";
})(InteractableType || (InteractableType = {}));
export var LogbookEntryType;
(function (LogbookEntryType) {
    LogbookEntryType["ITEM"] = "ITEM";
    LogbookEntryType["DOCUMENT"] = "DOCUMENT";
    LogbookEntryType["PHOTO"] = "PHOTO";
    LogbookEntryType["BROADCAST"] = "BROADCAST";
    LogbookEntryType["DEDUCTION"] = "DEDUCTION";
    LogbookEntryType["NOTE"] = "NOTE";
})(LogbookEntryType || (LogbookEntryType = {}));
export var Direction;
(function (Direction) {
    Direction["N"] = "N";
    Direction["NE"] = "NE";
    Direction["E"] = "E";
    Direction["SE"] = "SE";
    Direction["S"] = "S";
    Direction["SW"] = "SW";
    Direction["W"] = "W";
    Direction["NW"] = "NW";
})(Direction || (Direction = {}));
export var RunStatus;
(function (RunStatus) {
    RunStatus["ACTIVE"] = "ACTIVE";
    RunStatus["SUCCESS"] = "SUCCESS";
    RunStatus["DEATH"] = "DEATH";
})(RunStatus || (RunStatus = {}));
// ─── THREAT TYPES ───
export var HuskType;
(function (HuskType) {
    HuskType["SKOTH"] = "SKOTH";
    HuskType["GLOWBUBS"] = "GLOWBUBS";
    HuskType["JAWIES"] = "JAWIES";
    HuskType["WHITES"] = "WHITES";
    HuskType["OLDBONES"] = "OLDBONES";
    HuskType["DISABLED"] = "DISABLED";
    HuskType["NOIRE"] = "NOIRE";
    HuskType["BLOATERS"] = "BLOATERS";
    HuskType["AQUATIC"] = "AQUATIC";
})(HuskType || (HuskType = {}));
export var InfectedType;
(function (InfectedType) {
    InfectedType["THEY_THINK"] = "THEY_THINK";
    InfectedType["THEY_TALK"] = "THEY_TALK";
    InfectedType["THEY_TRICK"] = "THEY_TRICK";
    InfectedType["THEY_TAKE"] = "THEY_TAKE";
    InfectedType["GLITCH"] = "GLITCH";
})(InfectedType || (InfectedType = {}));
export var GhuulType;
(function (GhuulType) {
    GhuulType["APEX"] = "APEX";
})(GhuulType || (GhuulType = {}));
export var DetectionMethod;
(function (DetectionMethod) {
    DetectionMethod["SIGHT"] = "SIGHT";
    DetectionMethod["SOUND"] = "SOUND";
    DetectionMethod["VIBRATION"] = "VIBRATION";
    DetectionMethod["SMELL"] = "SMELL";
    DetectionMethod["BEHAVIOR"] = "BEHAVIOR";
    DetectionMethod["UNKNOWN"] = "UNKNOWN";
})(DetectionMethod || (DetectionMethod = {}));
//# sourceMappingURL=types.js.map