// Monorepo-aware Metro config.
//
// npm workspaces hoists shared deps to the root node_modules. Metro by
// default only looks inside the project's own node_modules and walks up,
// which works when modules are hoisted but trips on RN's "single React
// instance" rule when the same dep also exists at the workspace root.
// disableHierarchicalLookup + explicit nodeModulesPaths gives Metro a
// deterministic two-stop search: this workspace, then the root.

const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
