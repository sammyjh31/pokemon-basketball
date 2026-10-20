/** Resolve bundled public files at either the local root or a hosted subpath. */
export const publicAsset = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
