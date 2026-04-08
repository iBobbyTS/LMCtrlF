export const resolvePublicAssetPath = (
  assetPath: string,
  baseUrl: string = import.meta.env.BASE_URL
): string => {
  const normalizedAssetPath = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;

  if (!baseUrl || baseUrl === "/") {
    return `/${normalizedAssetPath}`;
  }

  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBaseUrl}${normalizedAssetPath}`;
};

export const dragAndDropArrowPath = resolvePublicAssetPath("dragndroparrow.png");
