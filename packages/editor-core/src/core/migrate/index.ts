export { legacyJsonToBlocks } from "./legacy-json-to-blocks"
export { createLegacyEditorExtensions } from "./legacy-extensions"
export {
  CURRENT_SCHEMA_VERSION,
  encodeLegacyV1FixtureSnapshot,
  migrateV1YDocToV2,
  readYDocSchemaVersion,
  writeYDocSchemaVersion,
} from "./migrate-ydoc"
