// CSS imports used by the Expo template's web components. The classes object
// is intentionally loose — CSS modules on web resolve at bundle time.
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "*.css";
