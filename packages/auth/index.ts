// Re-export everything from src
export * from "./src/index";

// Re-export middleware
export { authMiddleware, publicRoutes, isPublicRoute } from "./src/middleware";
