import BaseWall from"../../../common/documents/wall.mjs";import ServerDocumentMixin from"../backend/server-document.mjs";export default class Wall extends(ServerDocumentMixin(BaseWall)){static _migrationRegistry=[...super._migrationRegistry,{fn:migrateSense,version:12},{fn:migrateLimited,version:12}]}function migrateSense(e){return"sense"in e&&("sight"in e||(e.sight=e.sense),"light"in e||(e.light=e.sense),delete e.sense,!0)}function migrateLimited(e){const i={1:CONST.WALL_SENSE_TYPES.NORMAL,2:CONST.WALL_SENSE_TYPES.LIMITED},n=["light","move","sight","sound"];let t=!1;for(const s of n){if(!(s in e))continue;const n=e[s];n in i&&(e[s]=i[n],t=!0)}return t}