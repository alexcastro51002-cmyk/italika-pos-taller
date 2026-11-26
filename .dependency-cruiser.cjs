/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-cross-feature-imports",
      severity: "error",
      comment: "Vertical slices must not import from another feature slice.",
      from: { path: "^src/features/([^/]+)/" },
      to: {
        path: "^src/features/([^/]+)/",
        pathNot: "^src/features/$1/",
      },
    },
    {
      name: "no-shared-to-features",
      severity: "error",
      comment:
        "src/shared must remain minimal and independent of features or web UI.",
      from: { path: "^src/shared/" },
      to: { path: "^src/(features|web)/" },
    },
    {
      name: "no-web-to-backend",
      severity: "error",
      comment: "Frontend may only import pure types from src/shared/types.ts.",
      from: { path: "^src/web/" },
      to: {
        path: "^(src/features/|src/app\\.ts|src/server\\.ts|src/shared/(db|security|http|events)\\.ts|node:)",
      },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies are forbidden.",
      from: { path: "^src/" },
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["types", "import", "node", "default"],
    },
  },
};
